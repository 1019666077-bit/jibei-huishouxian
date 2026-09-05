const engine = require('../core/engine')
const metaStore = require('../core/meta')
const ads = require('../utils/ads')
const Scroll = require('../runtime/scroll')
const { COLORS } = require('../runtime/ui')
const feel = require('../runtime/feel')
const present = require('../runtime/present')
const stage = require('../runtime/stage')

function rankMessages(list) {
  const score = line => {
    if (/⚠|倒在|生命归零/.test(line)) return 4
    if (/✗ |挨打|损失|-\d+ HP/.test(line)) return 3
    if (/收入背包|顺手拿走|绝密|接管 \[/.test(line)) return 2
    return 1
  }
  return list.map((line, index) => ({ line, index }))
    .sort((a, b) => score(b.line) - score(a.line) || a.index - b.index)
    .map(item => item.line)
}

module.exports = manager => ({
  enter() {
    this.mainScroll = new Scroll()
    this.bagScroll = new Scroll()
    this.bagOpen = false
    this.busy = false
    this.settled = false
    this.messages = []
    this.meta = metaStore.load()

    let preset = null
    try {
      preset = wx.getStorageSync('retry_preset') || null
      wx.removeStorageSync('retry_preset')
    } catch (e) { preset = null }

    const medical = ads.consumeMedicalSupply()
    const affordable = metaStore.affordable(this.meta)
    const opener = this.meta.runs === 0 && !preset
    let loadout = opener
      ? (affordable.half ? 'half' : 'knife')
      : metaStore.preferredLoadout(this.meta)
    if (preset && preset.loadout && affordable[preset.loadout]) loadout = preset.loadout
    else if (preset && preset.loadout && !affordable[preset.loadout]) {
      this.messages.push(`改带${engine.LOADOUTS[loadout].name}`)
    }
    this.meta.lastLoadout = loadout
    if (!opener) {
      const charged = this.charge(loadout)
      if (!charged.ok) {
        loadout = 'knife'
        this.meta.lastLoadout = loadout
        metaStore.save(this.meta)
      }
    } else {
      metaStore.save(this.meta)
    }

    const options = {
      balance: this.meta.balance,
      extraMed: medical ? 1 : 0,
      autoLoadout: loadout,
      opener
    }
    if (preset && preset.goal) options.goal = preset.goal
    this.run = engine.newRun(options)
    if (medical) this.messages.push('药+1')
    if (preset && preset.goal) this.messages.unshift(present.clip(preset.goal, 12))
    if (opener) this.messages.unshift('雾里有人。柜还亮。')
    this.pickup = null
    this.pickupUntil = 0
    this.endTimer = null
    this.hintedBox = false
    this.hintedExtract = false
    this.actor = { nx: 0.5, ny: 0.82 }
    this.walk = null
    this.walkTick = null
    this.fight = null
    this.seenNode = ''
    this.tick = 0
    Scroll.resetView(manager.canvas)
    if (this.breath) clearInterval(this.breath)
    this.breath = setInterval(() => {
      this.tick += 1
      manager.requestRender()
    }, 120)
    try {
      if (typeof wx.setKeepScreenOn === 'function') wx.setKeepScreenOn({ keepScreenOn: true })
    } catch (e) { /* 部分机型无常亮接口 */ }
  },

  leave() {
    this.stopWalkTick()
    if (this.breath) {
      clearInterval(this.breath)
      this.breath = null
    }
    try {
      if (typeof wx.setKeepScreenOn === 'function') wx.setKeepScreenOn({ keepScreenOn: false })
    } catch (e) { /* ignore */ }
    if (this.endTimer) {
      clearTimeout(this.endTimer)
      this.endTimer = null
    }
    if (this.run && this.run.ended && !this.settled) this.finish()
  },

  onHide() {
    this.stopWalkTick()
    if (this.breath) {
      clearInterval(this.breath)
      this.breath = null
    }
  },

  onShow() {
    if ((this.walk || this.fight) && !this.walkTick && !this.settled) this.startWalkTick()
    if (!this.breath && !this.settled) {
      this.breath = setInterval(() => {
        this.tick += 1
        manager.requestRender()
      }, 120)
    }
  },

  charge(loadout) {
    const result = metaStore.charge(this.meta, loadout)
    if (result.ok) metaStore.save(this.meta)
    return result
  },

  pick(idx) {
    if (this.busy || !this.run || this.run.ended) return
    this.busy = true
    try {
      const node = this.run.node
      const option = node && node.options.find(item => String(item.idx) === String(idx))
      if (!option || option.disabled) {
        this.busy = false
        return
      }
      if (node.type === 'loadout' && option.loadout) {
        const charged = this.charge(option.loadout)
        if (!charged.ok) {
          this.messages.unshift(present.clip(charged.reason, 12))
          this.busy = false
          manager.requestRender()
          return
        }
      }
      const hpBefore = this.run.hp
      const lootBefore = this.run.loot.length
      const result = engine.choose(this.run, idx)
      this.messages = rankMessages(result.messages).concat(this.messages).slice(0, 8)
      this.mainScroll.reset()
      const fx = feel.classify(
        { hp: hpBefore, lootCount: lootBefore },
        this.run,
        result.messages
      )
      manager.pulse(fx.kind, fx.label)
      if (fx.item) {
        this.pickup = fx.item
        this.pickupUntil = Date.now() + 1200
      }
      if (this.run.ended) {
        const wait = feel.liveSting() ? 780 : 0
        if (wait) {
          manager.requestRender()
          this.endTimer = setTimeout(() => this.finish(), wait)
        } else {
          this.finish()
        }
        return
      }
      engine.refreshNode(this.run)
      this.teach()
      this.stopWalkTick()
      this.walk = null
      this.fight = null
      this.placeActor(this.run.node)
    } catch (e) {
      this.messages.unshift('这一步没能执行，请再点一次。')
    }
    manager.requestRender()
    setTimeout(() => { this.busy = false }, 280)
  },

  useMed() {
    const result = engine.useMed(this.run)
    if (!result) return
    engine.refreshNode(this.run)
    this.messages.unshift(`+${result.healed}`)
    manager.pulse('heal', `+${result.healed} 生命`)
    manager.requestRender()
  },

  goExtract() {
    if (this.busy || !this.run || this.run.ended || !engine.canExtractNow(this.run)) return
    this.busy = true
    this.stopWalkTick()
    this.walk = null
    this.fight = null
    try {
      const result = engine.forceExtract(this.run)
      this.messages = rankMessages(result.messages).concat(this.messages).slice(0, 8)
      this.mainScroll.reset()
      this.teach()
      manager.pulse('ok', '转向撤离线')
    } catch (e) {
      this.messages.unshift('现在还不能撤离，请再试一次。')
    }
    manager.requestRender()
    setTimeout(() => { this.busy = false }, 280)
  },

  toggleBag() {
    this.bagOpen = !this.bagOpen
    manager.requestRender()
  },

  toggleSecure(id) {
    const result = engine.toggleSecure(this.run, id)
    engine.refreshNode(this.run)
    this.messages.unshift(result.ok
      ? `${result.secured ? '装入' : '移出'}低温回收匣：${result.item.name}`
      : `装箱失败：${result.message}`)
    manager.requestRender()
  },

  dropItem(id) {
    const dropped = engine.dropLoot(this.run, id)
    if (!dropped) return
    engine.refreshNode(this.run)
    this.messages.unshift(`丢弃 [${dropped.tierLabel}] ${dropped.name}`)
    manager.requestRender()
  },

  autoPack() {
    if (!this.run.loot.length) return
    engine.autoSecureBest(this.run)
    engine.refreshNode(this.run)
    this.messages.unshift('匣已装满')
    manager.pulse('ok', '回收匣已装满')
    manager.requestRender()
  },

  teach() {
    const runMeta = engine.getRunMeta(this.run)
    if (!this.hintedBox && this.run.loot.length >= 2 && runMeta.secureWeight === 0) {
      this.hintedBox = true
      this.messages.unshift('贵的，装箱。')
    }
    if (!this.hintedExtract && engine.canExtractNow(this.run) && this.run.loot.length) {
      this.hintedExtract = true
      this.messages.unshift('点右下撤离。')
    }
    if (this.run.node && this.run.node.type === 'escape' && this.run.loot.length && runMeta.secureWeight === 0) {
      this.messages.unshift('匣是空的。先装箱。')
      this.bagOpen = true
    }
  },

  finish() {
    if (this.settled) return
    this.settled = true
    if (this.endTimer) {
      clearTimeout(this.endTimer)
      this.endTimer = null
    }
    const report = this.run.report
    const wallet = metaStore.settle(this.meta, report)
    metaStore.save(this.meta)
    report.wallet = wallet
    report.codex = metaStore.codexView(this.meta)
    try {
      wx.setStorageSync('last_report', report)
      wx.removeStorageSync('last_rid')
    } catch (e) { /* 内存中的战报仍可继续显示 */ }
    manager.go('report', { report })
  },

  pointerStart(point) {
    if (!this.contentRect) return
    if (point.y < this.contentRect.y || point.y > this.contentRect.y + this.contentRect.h) return
    ;(this.bagOpen ? this.bagScroll : this.mainScroll).start(point.y)
  },

  pointerMove(point) {
    return (this.bagOpen ? this.bagScroll : this.mainScroll).move(point.y)
  },

  pointerEnd() {
    this.mainScroll.end()
    this.bagScroll.end()
  },

  stopWalkTick() {
    if (this.walkTick) {
      clearInterval(this.walkTick)
      this.walkTick = null
    }
  },

  startWalkTick() {
    if (this.walkTick) return
    this.walkTick = setInterval(() => {
      this.stepWalk()
      manager.requestRender()
    }, 32)
  },

  placeActor(node) {
    this.seenNode = node && node.id ? node.id : ''
    this.walk = null
    this.fight = null
    if (node && present.useMap(node)) {
      if (node.type === 'escape') {
        const p = present.ZONE_POS.extract
        this.actor = { nx: p.x, ny: p.y }
      } else {
        const p = present.ZONE_POS[this.run.zone] || present.ZONE_POS.harbor
        this.actor = { nx: p.x, ny: p.y }
      }
      return
    }
    this.actor = { nx: 0.5, ny: 0.82 }
  },

  approach(option, nx, ny, extra) {
    if (this.busy || this.fight) return
    if (option && option.disabled) return
    if (this.walk && option && this.walk.idx === option.idx && !extra) return
    if (this.walk && extra && extra.extract && this.walk.extract) return
    if (!this.actor) this.actor = { nx: 0.5, ny: 0.82 }
    const dist = Math.hypot((nx || 0) - this.actor.nx, (ny || 0) - this.actor.ny)
    this.walk = {
      fromX: this.actor.nx,
      fromY: this.actor.ny,
      toX: nx,
      toY: ny,
      start: Date.now(),
      ms: Math.max(140, Math.min(280, 140 + dist * 220)),
      idx: option ? option.idx : null,
      extract: !!(extra && extra.extract),
      fight: !!(option && option.rounds)
    }
    this.startWalkTick()
    manager.requestRender()
  },

  stepWalk() {
    if (this.fight) {
      if (Date.now() - this.fight.start < this.fight.ms) return
      const idx = this.fight.idx
      this.fight = null
      this.stopWalkTick()
      this.pick(idx)
      return
    }
    if (!this.walk || !this.actor) return
    const span = Math.max(1, this.walk.ms)
    const t = Math.min(1, (Date.now() - this.walk.start) / span)
    this.actor.nx = this.walk.fromX + (this.walk.toX - this.walk.fromX) * t
    this.actor.ny = this.walk.fromY + (this.walk.toY - this.walk.fromY) * t
    if (t < 1) return
    const walk = this.walk
    this.walk = null
    if (walk.extract) {
      this.stopWalkTick()
      this.goExtract()
      return
    }
    if (walk.fight) {
      this.fight = { start: Date.now(), ms: 260, idx: walk.idx }
      feel.beep('hit')
      return
    }
    this.stopWalkTick()
    this.pick(walk.idx)
  },

  pip(option) {
    if (!option) return ''
    if (option.disabled) {
      const reason = option.disabledReason || ''
      if (/备弹/.test(reason)) return '缺弹'
      if (/芯片/.test(reason)) return '缺芯片'
      if (/医疗/.test(reason)) return '没药'
      if (/电源|供电/.test(reason)) return '没电'
      if (/配给点|投入/.test(reason)) return '不够钱'
      return present.clip(reason, 8)
    }
    if (option.chance == null) return ''
    if (option.safe) return '稳'
    if (option.method === 'ambush' || (option.rounds && option.chance < 60)) {
      return `险 ${option.chance}%`
    }
    return `${option.chance}%`
  },

  renderHud(ui, v) {
    const left = v.safe.left + 10
    const width = v.safe.right - v.safe.left - 20
    const top = v.safe.top + 6
    const runMeta = engine.getRunMeta(this.run)
    const zone = runMeta.zoneName || present.ZONE_SHORT[this.run.zone] || '冻港'
    const toast = present.toast(this.messages)
    const hudH = toast ? 132 : 112
    ui.panel(left, top, width, hudH, {
      fill: '#10202c',
      stroke: '#3d5c74',
      radius: 12
    })
    ui.text(zone, left + 12, top + 8, 18, '#ffffff', '700', width * 0.58)
    ui.ctx.textAlign = 'right'
    ui.text(`${runMeta.timeText} · ${runMeta.phase || ''}`, left + width - 12, top + 10, 13, '#9ff0d4', '700')
    ui.ctx.textAlign = 'left'
    const meterW = (width - 36) / 2
    ui.meter(left + 12, top + 32, meterW, '生命', this.run.hp, this.run.hp / 100,
      this.run.hp < 60 ? COLORS.danger : COLORS.accent)
    ui.meter(left + 24 + meterW, top + 32, meterW, '风险', this.run.risk, this.run.risk / 100,
      this.run.risk >= 70 ? COLORS.danger : COLORS.gold)
    const ammoColor = runMeta.ammoClass === 'ammo-out' ? COLORS.danger : '#eef4fa'
    const chipW = (width - 36) / 2
    const chipY = top + 64
    ui.chip(left + 12, chipY, chipW, 20, `弹 ${runMeta.ammoRounds}`, {
      fill: '#0c1822',
      stroke: '#2a4156',
      color: ammoColor,
      size: 12
    })
    ui.chip(left + 24 + chipW, chipY, chipW, 20, `药 ${this.run.meds}`, {
      fill: '#0c1822',
      stroke: '#2a4156',
      color: this.run.meds ? COLORS.accent : COLORS.danger,
      size: 12
    })
    ui.chip(left + 12, chipY + 24, chipW, 20, `${runMeta.loadGrids}/${this.run.capacity}格`, {
      fill: '#0c1822',
      stroke: '#2a4156',
      color: '#eef4fa',
      size: 12
    })
    ui.chip(left + 24 + chipW, chipY + 24, chipW, 20, `芯片 ${this.run.cards || 0}`, {
      fill: '#0c1822',
      stroke: '#2a4156',
      color: this.run.cards ? COLORS.gold : COLORS.muted,
      size: 12
    })
    if (toast) {
      const hurt = /^-|倒/.test(toast)
      ui.text(toast, left + 12, top + 112, 13, hurt ? COLORS.danger : COLORS.gold, '700', width - 24)
    }
    return top + hudH + 8
  },

  renderOption(ui, x, y, w, option) {
    const h = 72
    const stripe = option.disabled ? '#2a3644' : option.rounds ? COLORS.danger : option.safe ? COLORS.accent : COLORS.gold
    ui.panel(x, y, w, h, {
      fill: option.disabled ? '#101720' : '#142131',
      stroke: option.disabled ? '#1e2936' : (option.chance != null && option.chance < 50 ? '#6c3c42' : COLORS.line),
      radius: 12,
      accent: stripe
    })
    const title = present.caption(option)
    ui.text(title, x + 18, y + 10, 16, option.disabled ? '#59697a' : COLORS.text, '700', w - 36)
    const pip = this.pip(option)
    const cost = option.costText ? present.clip(option.costText, 18) : ''
    const detail = [pip, cost].filter(Boolean).join(' · ')
    ui.text(detail || option.verb || '', x + 18, y + 40, 12,
      option.disabled ? '#4b5968' : (option.safe ? COLORS.accent : option.rounds ? COLORS.danger : COLORS.gold), '700', w - 36)
    ui.addHit(x, y, w, h, () => this.pick(option.idx), !option.disabled)
    return h
  },

  renderMap(ui, rect, travelNode) {
    const node = travelNode || this.run.node
    const pins = present.layoutPins(node, rect, true)
    const reachable = {}
    pins.forEach(pin => {
      reachable[present.pinZone(pin.opt, this.run.node)] = true
    })
    if (engine.canExtractNow(this.run) && this.run.node.type !== 'escape') reachable.extract = true
    reachable[this.run.zone] = true
    stage.drawCity(ui.ctx, rect, {
      current: this.run.zone,
      tick: this.tick,
      hot: this.run.risk >= 70,
      marker: 'pulse',
      reachable
    })
    if (rect.h >= 130) {
      ui.panel(rect.x + 6, rect.y + 4, 52, 18, { fill: 'rgba(8,16,20,0.72)', stroke: false, radius: 6, sheen: false })
      ui.text(this.run.node.type === 'escape' ? '撤法' : '路线', rect.x + 12, rect.y + 6, 11, COLORS.gold, '700')
    }
    const hasMethods = pins.some(pin => pin.opt.method || pin.opt.wait)
    Object.keys(present.ZONE_POS).forEach(key => {
      if (key === 'extract' && hasMethods) return
      const p = present.ZONE_POS[key]
      const px = rect.x + p.x * rect.w
      const py = rect.y + p.y * rect.h
      ui.addHit(px - 36, py - 44, 72, 72, () => this.pickZone(key, pins))
    })
    pins.forEach(pin => {
      const option = pin.opt
      if (option.method || option.wait) {
        stage.drawPad(ui.ctx, option.method || 'wait', pin.x, pin.y, !option.disabled, false)
        ui.panel(pin.x - 44, pin.y + 6, 88, 40, {
          fill: option.disabled ? '#101820' : '#142131',
          stroke: option.disabled ? COLORS.line : COLORS.gold,
          radius: 8
        })
        ui.ctx.textAlign = 'center'
        ui.text(present.caption(option), pin.x, pin.y + 9, 11, option.disabled ? '#6a7a88' : COLORS.text, '700', 80)
        const pip = this.pip(option)
        const cost = option.costText ? present.clip(option.costText, 8) : ''
        ui.text([pip, cost].filter(Boolean).join(' ') || (option.verb || ''), pin.x, pin.y + 24, 10,
          option.disabled ? '#6a7a88' : COLORS.gold, '700')
        ui.ctx.textAlign = 'left'
        ui.addHit(pin.x - 48, pin.y - 48, 96, 96, () => {
          if (option.disabled) {
            this.messages.unshift(this.pip(option) || '现在不行')
            manager.requestRender()
            return
          }
          this.pick(option.idx)
        })
      }
    })
  },

  pickZone(key, pins) {
    if (this.busy || this.fight) return
    const match = (pins || []).find(pin => !pin.opt.method && !pin.opt.wait && present.pinZone(pin.opt, this.run.node) === key && !pin.opt.disabled)
    if (match) {
      this.pick(match.opt.idx)
      return
    }
    if (key === 'extract' && engine.canExtractNow(this.run) && this.run.node.type !== 'escape') {
      this.goExtract()
      return
    }
    if (key === this.run.zone) {
      this.messages.unshift('就在这里。')
    } else {
      this.messages.unshift('现在去不了。')
    }
    manager.requestRender()
  },

  renderSite(ui, rect, viewNode) {
    const node = viewNode || this.run.node
    const zone = node.zone || this.run.zone || 'harbor'
    if (!present.useRoom(node)) {
      stage.drawZone(ui.ctx, zone, rect, this.tick)
      const x = rect.x + 10
      const w = rect.w - 20
      let y = rect.y + 12 - this.mainScroll.offset
      const start = y
      ui.text(node.text, x, y, 18, COLORS.text, '700', w)
      y += 34
      node.options.forEach(option => {
        y += this.renderOption(ui, x, y, w, option) + 8
      })
      this.mainScroll.setBounds(y - start + 12, rect.h)
      return
    }
    if (this.seenNode !== node.id) this.placeActor(node)
    stage.drawRoom(ui.ctx, zone, rect, this.tick)
    ui.panel(rect.x + 8, rect.y + 6, 44, 18, { fill: 'rgba(8,16,20,0.7)', stroke: false, radius: 6, sheen: false })
    ui.text('现场', rect.x + 14, rect.y + 8, 11, COLORS.gold, '700')
    ui.text(present.spot(node) || node.text, rect.x + 58, rect.y + 7, 14, COLORS.text, '700', rect.w - 70)
    if (node.revealItem) {
      const it = node.revealItem
      stage.drawItemIcon(ui.ctx, rect.x + 14, rect.y + 28, 16, it)
      ui.text(it.name, rect.x + 38, rect.y + 30, 13, COLORS.text, '700', rect.w - 54)
    }
    const wall = stage.ROOM_WALL
    const floor = {
      x: rect.x,
      y: rect.y + rect.h * wall,
      w: rect.w,
      h: rect.h * (1 - wall)
    }
    const props = present.layoutRoom(node, floor)
    const listMode = present.useOptionList(node)
    const hotIdx = this.walk ? this.walk.idx : (this.fight ? this.fight.idx : null)
    if (!this.actor) this.actor = { nx: 0.5, ny: 0.82 }
    const ax = floor.x + this.actor.nx * floor.w
    const ay = floor.y + this.actor.ny * floor.h
    if (this.walk) {
      const tx = floor.x + this.walk.toX * floor.w
      const ty = floor.y + this.walk.toY * floor.h
      stage.drawWalk(ui.ctx, ax, ay, tx, ty, this.tick)
    }
    const activate = (option, prop) => {
      if (option.disabled) {
        const why = this.pip(option) || '现在不行'
        this.messages.unshift(why)
        manager.requestRender()
        return
      }
      this.approach(option, prop.kind === 'threat' ? Math.max(0.08, prop.nx - 0.14) : prop.nx, prop.ny)
    }
    props.forEach(prop => {
      const option = prop.opt
      const hot = hotIdx === option.idx
      stage.drawProp(ui.ctx, prop.kind, prop.x, prop.y, !option.disabled, this.tick, hot)
      if (listMode) {
        ui.addHit(prop.x - 28, prop.y - 36, 56, 64, () => activate(option, prop))
        return
      }
      const plateY = prop.y + 6
      ui.panel(prop.x - 50, plateY, 100, 46, {
        fill: hot ? '#1e4f43' : '#101820',
        stroke: option.disabled ? COLORS.line : (prop.kind === 'threat' ? COLORS.danger : COLORS.gold),
        radius: 8
      })
      ui.ctx.textAlign = 'center'
      ui.text(present.caption(option), prop.x, plateY + 5, 12, option.disabled ? '#6a7a88' : COLORS.text, '700', 92)
      const pip = this.pip(option)
      const cost = option.costText ? present.clip(option.costText, 8) : ''
      ui.text([pip, cost].filter(Boolean).join(' · ') || present.propName(option), prop.x, plateY + 26, 11,
        option.disabled ? '#6a7a88' : (prop.kind === 'threat' ? COLORS.danger : COLORS.gold), '700')
      ui.ctx.textAlign = 'left'
      ui.addHit(prop.x - 52, prop.y - 58, 104, 116, () => activate(option, prop))
    })
    if (listMode) {
      const rowH = 34
      const listH = props.length * rowH + 4
      let ly = Math.min(floor.y + floor.h - listH - 4, floor.y + 10)
      ly = Math.max(floor.y + 4, ly)
      const lx = floor.x + 8
      const lw = floor.w - 16
      props.forEach((prop, i) => {
        const option = prop.opt
        const hot = hotIdx === option.idx
        const y = ly + i * rowH
        ui.panel(lx, y, lw, rowH - 4, {
          fill: hot ? '#1e4f43' : '#101820',
          stroke: option.disabled ? COLORS.line : (prop.kind === 'threat' ? COLORS.danger : COLORS.gold),
          radius: 8
        })
        ui.text(present.caption(option), lx + 10, y + 6, 12, option.disabled ? '#6a7a88' : COLORS.text, '700', lw - 88)
        const pip = this.pip(option)
        ui.ctx.textAlign = 'right'
        ui.text(pip || present.propName(option), lx + lw - 10, y + 7, 11,
          option.disabled ? '#6a7a88' : (prop.kind === 'threat' ? COLORS.danger : COLORS.gold), '700')
        ui.ctx.textAlign = 'left'
        ui.addHit(lx, y, lw, rowH - 4, () => activate(option, prop))
      })
    }
    if (this.fight) {
      const threat = props.find(item => item.opt.idx === this.fight.idx)
      if (threat) stage.drawFight(ui.ctx, ax, ay, threat.x, threat.y, this.tick)
    }
    const facing = this.walk && this.walk.toX < this.actor.nx ? -1 : 1
    stage.drawActor(ui.ctx, ax, ay, this.tick, {
      facing,
      walking: !!this.walk
    })
    this.mainScroll.setBounds(rect.h, rect.h)
  },

  renderRunContent(ui, rect) {
    const node = this.run.node
    const options = node.options || []
    const travel = options.filter(opt => present.isTravel(opt))
    const local = options.filter(opt => !present.isTravel(opt))
    const showMap = travel.length > 0 || present.useMap(node)
    const showSite = local.length > 0 || (!showMap && present.useRoom(node))
    if (showMap && showSite) {
      const mapH = Math.max(124, Math.min(150, Math.round(rect.h * 0.30)))
      const mapRect = { x: rect.x, y: rect.y, w: rect.w, h: mapH }
      stage.drawCity(ui.ctx, mapRect, {
        current: this.run.zone,
        tick: this.tick,
        hot: this.run.risk >= 70,
        marker: 'pulse',
        compact: true,
        reachable: this.reachMap(node, travel)
      })
      this.renderMapHits(ui, mapRect, travel, node)
      const siteRect = {
        x: rect.x,
        y: rect.y + mapH + 6,
        w: rect.w,
        h: Math.max(88, rect.h - mapH - 6)
      }
      this.renderSite(ui, siteRect, Object.assign({}, node, { options: local }))
      return
    }
    if (showMap) {
      this.renderMap(ui, rect, Object.assign({}, node, { options: travel.length ? travel : options }))
      this.mainScroll.setBounds(rect.h, rect.h)
      return
    }
    this.renderSite(ui, rect, Object.assign({}, node, { options: local.length ? local : options }))
  },

  reachMap(node, travel) {
    const reachable = {}
    travel.forEach(opt => {
      reachable[present.pinZone(opt, node)] = true
    })
    if (engine.canExtractNow(this.run) && node.type !== 'escape') reachable.extract = true
    reachable[this.run.zone] = true
    return reachable
  },

  renderMapHits(ui, rect, travel, node) {
    const pins = present.layoutPins(Object.assign({}, node, { options: travel }), rect, true)
    Object.keys(present.ZONE_POS).forEach(key => {
      const p = present.ZONE_POS[key]
      const px = rect.x + p.x * rect.w
      const py = rect.y + p.y * rect.h
      ui.addHit(px - 32, py - 28, 64, 56, () => this.pickZone(key, pins))
    })
    pins.forEach(pin => {
      const option = pin.opt
      const above = pin.ny > 0.58
      const plateW = 58
      const plateH = 18
      let plateX = pin.x - plateW / 2
      let plateY = above ? pin.y - plateH - 6 : pin.y + 10
      plateX = Math.min(rect.x + rect.w - plateW - 2, Math.max(rect.x + 2, plateX))
      plateY = Math.min(rect.y + rect.h - plateH - 2, Math.max(rect.y + 2, plateY))
      if (option.method || option.wait) {
        stage.drawPad(ui.ctx, option.method || 'wait', pin.x, pin.y, !option.disabled, false)
      }
      ui.panel(plateX, plateY, plateW, plateH, {
        fill: option.disabled ? '#101820' : '#142131',
        stroke: option.disabled ? COLORS.line : (option.rounds ? COLORS.danger : COLORS.gold),
        radius: 6,
        sheen: false
      })
      ui.ctx.textAlign = 'center'
      ui.text(option.verb || present.caption(option), plateX + plateW / 2, plateY + 3, 10,
        option.disabled ? '#6a7a88' : COLORS.text, '700', plateW - 8)
      ui.ctx.textAlign = 'left'
      ui.addHit(pin.x - 36, pin.y - 28, 72, 56, () => {
        if (option.disabled) {
          this.messages.unshift(this.pip(option) || '现在不行')
          manager.requestRender()
          return
        }
        this.pick(option.idx)
      })
    })
  },

  renderBag(ui, rect) {
    const x = rect.x + 4
    const w = rect.w - 8
    let y = rect.y + 4 - this.bagScroll.offset
    const start = y
    const runMeta = engine.getRunMeta(this.run)
    ui.panel(x, y, w, 70, { fill: '#122018', stroke: COLORS.accent, radius: 12 })
    ui.text(`背包 ${runMeta.loadGrids}/${this.run.capacity} 格`, x + 14, y + 10, 18, COLORS.text, '700')
    ui.text(`低温回收匣 ${runMeta.secureWeight}/${this.run.safebox} 格 · 贵重先装箱`, x + 14, y + 40, 12, COLORS.accent)
    y += 84
    if (this.run.loot.length) {
      ui.button(x, y, w, 36, '按价值装满回收匣', () => this.autoPack(), {
        size: 13,
        fill: '#1e4f43',
        stroke: COLORS.accent
      })
      y += 46
    }
    if (!this.run.loot.length) {
      ui.panel(x, y, w, 70)
      ui.text('背包还是空的。', x + 14, y + 24, 13, COLORS.muted)
      y += 80
    }
    this.run.loot.forEach(item => {
      const accent = item.tier === 'red' ? COLORS.danger : item.tier === 'gold' ? COLORS.gold
        : item.tier === 'purple' ? '#b48cff' : COLORS.line
      ui.panel(x, y, w, 96, {
        stroke: accent,
        fill: item.secured ? '#13241c' : '#111925',
        accent
      })
      stage.drawItemIcon(ui.ctx, x + 14, y + 14, 22, item)
      ui.text(item.name, x + 46, y + 12, 14, COLORS.text, '700', w - 60)
      ui.text(`${engine.fmtVal(item.value)} · ${item.weight}格${item.secured ? ' · 已入匣' : ''}`,
        x + 46, y + 36, 12, item.secured ? COLORS.accent : COLORS.muted)
      const buttonWidth = (w - 34) / 2
      ui.button(x + 10, y + 58, buttonWidth, 28, item.secured ? '移出回收匣' : '装入回收匣',
        () => this.toggleSecure(item.lootId), { size: 12, radius: 8 })
      ui.button(x + 24 + buttonWidth, y + 58, buttonWidth, 28, '丢弃',
        () => this.dropItem(item.lootId), { size: 12, radius: 8, color: COLORS.danger })
      y += 106
    })
    const contentHeight = y - start + 8
    this.bagScroll.setBounds(contentHeight, rect.h)
  },

  render(ui, v) {
    const contentTop = this.renderHud(ui, v)
    const toolbarH = 64
    const bottom = v.safe.bottom - toolbarH
    this.contentRect = {
      x: v.safe.left + 8,
      y: contentTop,
      w: v.safe.right - v.safe.left - 16,
      h: Math.max(100, bottom - contentTop)
    }
    ui.withClip(this.contentRect, () => {
      if (this.bagOpen) this.renderBag(ui, this.contentRect)
      else this.renderRunContent(ui, this.contentRect)
    })

    const left = v.safe.left + 12
    const width = v.safe.right - v.safe.left - 24
    const y = v.safe.bottom - 56
    const gap = 8
    const bw = (width - gap * 2) / 3
    const medEnabled = this.run.meds > 0 && this.run.hp < 100 && !this.run.ended
    const bagHot = this.pickup && Date.now() < this.pickupUntil
    const medHot = medEnabled && this.run.hp < 60
    const extractOn = engine.canExtractNow(this.run) && !this.run.ended
    const extractHot = extractOn && (this.run.hp < 60 || this.run.risk >= 70)
    ui.button(left, y, bw, 48, this.bagOpen ? '关闭' : `背包 ${this.run.loot.length}`,
      () => this.toggleBag(), {
        size: 14,
        fill: this.bagOpen ? '#28443c' : (bagHot ? '#3a2e16' : '#172333'),
        stroke: bagHot ? COLORS.gold : COLORS.line,
        color: bagHot ? COLORS.gold : COLORS.text
      })
    ui.button(left + bw + gap, y, bw, 48,
      `打药 ${this.run.meds}`, () => this.useMed(), {
        size: 14,
        enabled: medEnabled,
        fill: medHot ? '#3a2a16' : '#293b2c',
        stroke: medHot ? COLORS.gold : COLORS.line,
        color: medHot ? COLORS.gold : COLORS.accent
      })
    ui.button(left + (bw + gap) * 2, y, bw, 48, '撤离', () => this.goExtract(), {
      size: 14,
      enabled: extractOn,
      fill: extractHot ? '#3a2a16' : '#172333',
      stroke: extractHot ? COLORS.gold : COLORS.line,
      color: extractHot ? COLORS.gold : COLORS.text
    })

    if (this.run.risk >= 55) {
      const danger = Math.min(0.28, (this.run.risk - 55) / 180)
      ui.ctx.fillStyle = `rgba(90,12,18,${danger})`
      ui.ctx.fillRect(0, 0, v.width, 28)
      ui.ctx.fillRect(0, v.height - 36, v.width, 36)
    }

    this.renderPickup(ui, v)
    this.renderEnding(ui, v)
  },

  renderEnding(ui, v) {
    if (!this.run.ended || this.settled) return
    const win = !!(this.run.report && this.run.report.escaped)
    ui.ctx.fillStyle = win ? 'rgba(8,24,18,0.72)' : 'rgba(28,8,10,0.78)'
    ui.ctx.fillRect(0, 0, v.width, v.height)
    ui.ctx.textAlign = 'center'
    ui.text(win ? '活着出来了' : '没能回来', v.width / 2, v.height * 0.42, 32,
      win ? COLORS.accent : COLORS.danger, '700')
    ui.ctx.textAlign = 'left'
  },

  renderPickup(ui, v) {
    if (!this.pickup || Date.now() > this.pickupUntil) return
    const item = this.pickup
    const w = Math.min(240, v.safe.right - v.safe.left - 48)
    const x = (v.width - w) / 2
    const y = v.height * 0.32
    const hot = item.tier === 'red' || item.tier === 'gold'
    ui.panel(x, y, w, 84, {
      fill: hot ? '#2c1c14' : '#182433',
      stroke: hot ? COLORS.gold : COLORS.accent,
      radius: 14
    })
    stage.drawItemIcon(ui.ctx, x + 16, y + 26, 24, item)
    ui.text(item.name, x + 50, y + 22, 16, COLORS.text, '700', w - 66)
    ui.text(engine.fmtVal(item.value), x + 48, y + 48, 13, COLORS.gold, '600')
  }
})
