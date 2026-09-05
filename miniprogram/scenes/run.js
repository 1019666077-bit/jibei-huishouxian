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
    if (opener) this.messages.unshift('内环合闸开索道')
    this.pickup = null
    this.pickupUntil = 0
    this.endTimer = null
    this.hintedBox = false
    this.hintedExtract = false
    this.hintedCore = false
    this.hintedLever = false
    this.hintedCable = false
    this.hintedLate = false
    this.juice = null
    this.lessonOpen = false
    this.lessonKind = ''
    this.lessonSeen = false
    this.lessonCableSeen = false
    this.taughtCable = false
    try { this.taughtCable = !!wx.getStorageSync('lesson_cable_v1') } catch (e) { this.taughtCable = false }
    this.listRect = null
    this.actor = { nx: 0.5, ny: 0.82 }
    this.walk = null
    this.walkTick = null
    this.fight = null
    this.seenNode = ''
    this.tick = 0
    this.teach()
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
      const leversBefore = this.run.levers || 0
      const result = engine.choose(this.run, idx)
      this.messages = rankMessages(result.messages).concat(this.messages).slice(0, 8)
      this.mainScroll.reset()
      const fx = feel.classify(
        {
          hp: hpBefore,
          lootCount: lootBefore,
          fight: !!(option && option.rounds),
          levers: leversBefore,
          extract: present.isCable(option)
        },
        this.run,
        result.messages
      )
      manager.pulse(fx.kind, fx.stamp || fx.label)
      if (fx.item) {
        this.pickup = fx.item
        this.pickupUntil = Date.now() + 1400
      }
      if (fx.stamp) {
        this.flashJuice(fx.mark || 'ok', fx.stamp, {
          silent: true,
          sub: fx.sub || (fx.item ? fx.item.name : ''),
          kind: fx.kind
        })
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
    this.flashJuice('ok', '回血', { kind: 'heal', sub: `+${result.healed} 生命` })
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
      this.flashJuice('ok', '撤离', { kind: 'extract', sub: '选一条撤出' })
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

  flashJuice(kind, label, options) {
    const opts = options || {}
    this.juice = {
      kind: opts.kind || kind,
      mark: kind,
      label,
      sub: opts.sub || '',
      until: Date.now() + 1400
    }
    if (opts.silent) return
    if (typeof manager.pulse === 'function') manager.pulse(opts.kind || kind, label)
  },

  dismissLesson() {
    this.lessonOpen = false
    this.taughtCable = true
    try { wx.setStorageSync('lesson_cable_v1', { at: Date.now() }) } catch (e) { /* 无存储时本局不再强弹 */ }
    manager.requestRender()
  },

  toggleSecure(id) {
    const result = engine.toggleSecure(this.run, id)
    engine.refreshNode(this.run)
    if (result.ok) {
      const label = result.secured ? '入匣' : '移出'
      this.messages.unshift(`${result.secured ? '装入' : '移出'}低温回收匣：${result.item.name}`)
      this.flashJuice('ok', label)
    } else {
      this.messages.unshift(`装箱失败：${result.message}`)
      this.flashJuice('bad', '装不下')
    }
    manager.requestRender()
  },

  dropItem(id) {
    const dropped = engine.dropLoot(this.run, id)
    if (!dropped) return
    engine.refreshNode(this.run)
    this.messages.unshift(`丢弃 [${dropped.tierLabel}] ${dropped.name}`)
    this.flashJuice('bad', '丢弃')
    manager.requestRender()
  },

  autoPack() {
    if (!this.run.loot.length) return
    engine.autoSecureBest(this.run)
    engine.refreshNode(this.run)
    this.messages.unshift('匣已装满')
    this.flashJuice('ok', '匣已装满')
    manager.requestRender()
  },

  optionLook(option) {
    const tone = present.optionTone(option)
    const nudge = present.leverNudge(this.run)
    const target = nudge && present.isLeverTarget(option)
    const highlight = present.isLever(option) || present.isLeverHint(option)
      || (present.isCable(option) && this.run && this.run.levers >= 2)
      || target
    return {
      tone: target ? 'lever' : tone,
      color: present.toneColor(target ? 'lever' : tone),
      fill: present.toneFill(target ? 'lever' : tone),
      label: target && !present.isLever(option) && !present.isLeverHint(option) ? '内环' : present.toneLabel(tone),
      highlight
    }
  },

  teach() {
    const runMeta = engine.getRunMeta(this.run)
    const options = (this.run.node && this.run.node.options) || []
    const hasLever = options.some(opt => present.isLever(opt))
    const hasHint = options.some(opt => present.isLeverHint(opt))
    if (!this.hintedLever && hasLever && this.run.levers < 2) {
      this.hintedLever = true
      this.hintedCore = true
      this.messages.unshift('先合闸，再走索道')
    } else if (!this.hintedCore && this.run.levers < 2 && (this.run.tutorial || this.run.zone === 'core' || hasHint)) {
      this.hintedCore = true
      this.messages.unshift('内环可合闸开索道')
    }
    if (!this.hintedCable && this.run.levers >= 2) {
      this.hintedCable = true
      this.messages.unshift('电源已通，点索道')
    }
    if (!this.hintedLate && present.leverNudge(this.run) && this.run.zone !== 'core' && !hasLever && !hasHint) {
      this.hintedLate = true
      this.messages.unshift('冷却舱·压缩机房可合闸')
    }
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
    if (present.shouldForceLesson(this.run, {
      taught: this.taughtCable,
      seenLever: this.lessonSeen,
      seenCable: this.lessonCableSeen
    })) {
      const card = present.lesson(this.run)
      this.lessonOpen = true
      this.lessonKind = card.kind
      if (card.kind === 'cable') this.lessonCableSeen = true
      else this.lessonSeen = true
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
    if (this.lessonOpen) return
    if (!this.contentRect) return
    if (point.y < this.contentRect.y || point.y > this.contentRect.y + this.contentRect.h) return
    if (this.bagOpen) {
      this.bagScroll.start(point.y)
      return
    }
    if (this.listRect) {
      if (point.y < this.listRect.y || point.y > this.listRect.y + this.listRect.h) return
    }
    this.mainScroll.start(point.y)
  },

  wheel(delta, point) {
    const scroll = this.bagOpen ? this.bagScroll : this.mainScroll
    if (!scroll || !scroll.max) return false
    const area = this.bagOpen ? this.contentRect : (this.listRect || this.contentRect)
    if (point && area) {
      if (point.x < area.x || point.x > area.x + area.w ||
          point.y < area.y || point.y > area.y + area.h) return false
    }
    return scroll.wheel(delta)
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
    if (present.dangerPip(option)) return `${option.chance}%`
    return `${option.chance}%`
  },

  renderHud(ui, v) {
    const left = v.safe.left + 10
    const width = v.safe.right - v.safe.left - 20
    const top = v.safe.top + 6
    const runMeta = engine.getRunMeta(this.run)
    const zone = present.ZONE_SHORT[this.run.zone] || '冻港'
    const toast = present.toast(this.messages)
    const paceRaw = present.paceHint(this.run)
    const pace = toast ? '' : (/残局|选一条撤/.test(paceRaw) ? paceRaw : '')
    const hudH = toast || pace ? 128 : 108
    ui.panel(left, top, width, hudH, {
      fill: '#08141c',
      stroke: '#5a86a4',
      radius: 16,
      rim: COLORS.ice
    })
    ui.text(zone, left + 16, top + 10, 13, COLORS.body, '700', 52)
    const powerOn = this.run.levers >= 2
    const needLever = !powerOn
    ui.chip(left + 72, top + 8, 118, 28, needLever ? `合闸 ${this.run.levers}/2` : `供电已通`, {
      fill: powerOn ? '#132820' : '#2a2410',
      stroke: powerOn ? COLORS.accent : COLORS.gold,
      color: powerOn ? COLORS.accent : COLORS.gold,
      size: 15
    })
    const late = (this.run.step || 0) >= 6
    const stepLabel = runMeta.stepText || present.stepChip(this.run)
    ui.chip(left + width - 88, top + 10, 74, 24, stepLabel, {
      fill: late ? '#2c171b' : '#0c1820',
      stroke: late ? COLORS.danger : '#3d5c74',
      color: late ? '#ffd0d0' : COLORS.body,
      size: 12
    })
    const meterW = (width - 40) / 2
    ui.meter(left + 16, top + 42, meterW, '生命', this.run.hp, this.run.hp / 100,
      this.run.hp < 60 ? COLORS.danger : COLORS.accent)
    ui.meter(left + 24 + meterW, top + 42, meterW, '风险', this.run.risk, this.run.risk / 100,
      this.run.risk >= 70 ? COLORS.danger : COLORS.gold)
    const stripY = top + 78
    ui.panel(left + 12, stripY, width - 24, 22, {
      fill: '#061018',
      stroke: false,
      radius: 8,
      sheen: false
    })
    const bits = [
      { glyph: 'ammo', label: `${runMeta.ammoRounds}`, color: runMeta.ammoClass === 'ammo-out' ? COLORS.danger : COLORS.text },
      { glyph: 'med', label: `${this.run.meds}`, color: this.run.meds ? COLORS.accent : COLORS.danger },
      { glyph: 'grid', label: `${runMeta.loadGrids}/${this.run.capacity}`, color: COLORS.text },
      { glyph: 'card', label: `${this.run.cards || 0}`, color: this.run.cards ? COLORS.gold : COLORS.muted }
    ]
    const bitW = (width - 40) / 4
    bits.forEach((bit, i) => {
      const x = left + 18 + i * bitW
      stage.drawHudGlyph(ui.ctx, bit.glyph, x, stripY + 4, 14)
      ui.text(bit.label, x + 18, stripY + 4, 12, bit.color, '700', bitW - 22)
    })
    if (toast || pace) {
      const line = toast || pace
      const hurt = /^-|倒|失手|挨打/.test(line)
      const leverToast = /合闸|供电|索道|通电/.test(line)
      ui.ctx.fillStyle = hurt ? COLORS.danger : (leverToast ? COLORS.gold : COLORS.accent)
      ui.ctx.fillRect(left + 16, top + 108, 5, 8)
      ui.text(line, left + 28, top + 104, 13, hurt ? '#ffd0d0' : COLORS.gold, '700', width - 48)
    }
    let next = top + hudH + 10
    const guide = present.leverGuide(this.run)
    if (guide) {
      const card = present.lesson(this.run)
      ui.panel(left, next, width, 56, {
        fill: '#241c0c',
        stroke: COLORS.gold,
        radius: 12,
        rim: COLORS.gold,
        sheen: false
      })
      stage.drawLessonRail(ui.ctx, { x: left + 10, y: next + 8, w: width - 20, h: 22 }, card.steps, this.tick)
      ui.text(guide, left + 12, next + 34, 13, '#ffe08a', '700', width - 24)
      next += 66
    }
    return next
  },

  renderOption(ui, x, y, w, option) {
    const h = 80
    const look = this.optionLook(option)
    const glow = look.highlight ? `rgba(255,198,92,${0.18 + 0.16 * Math.abs(Math.sin((this.tick || 0) * 0.28))})` : null
    ui.panel(x, y, w, h, {
      fill: option.disabled ? '#101720' : look.fill,
      stroke: option.disabled ? '#1e2936' : look.color,
      radius: 12,
      accent: option.disabled ? '#2a3644' : look.color,
      glow
    })
    stage.drawToneMark(ui.ctx, look.tone, x + 12, y + 12, 26)
    const title = present.listTitle(option)
    ui.wrapped(title, x + 46, y + 8, w - 60, {
      size: 15,
      lineHeight: 20,
      maxLines: 2,
      weight: '700',
      color: option.disabled ? '#59697a' : COLORS.text
    })
    const pip = this.pip(option)
    const cost = option.costText ? present.clip(option.costText, 14) : ''
    const risky = present.dangerPip(option)
    if (risky) {
      ui.chip(x + 46, y + 50, 28, 20, '险', {
        fill: '#4a2024',
        stroke: COLORS.danger,
        color: COLORS.danger,
        size: 12
      })
      ui.text([pip, cost].filter(Boolean).join(' · ') || look.label, x + 80, y + 52, 12,
        option.disabled ? '#4b5968' : COLORS.danger, '700', w - 94)
    } else {
      const detail = [look.label, pip, cost].filter(Boolean).join(' · ')
      ui.text(detail || option.verb || '', x + 46, y + 52, 12,
        option.disabled ? '#4b5968' : look.color, '700', w - 60)
    }
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
    if (present.leverNudge(this.run)) reachable.core = true
    stage.drawCity(ui.ctx, rect, {
      current: this.run.zone,
      tick: this.tick,
      hot: this.run.risk >= 70,
      marker: 'pulse',
      reachable,
      target: present.leverNudge(this.run) ? 'core' : ''
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
        const look = this.optionLook(option)
        stage.drawPad(ui.ctx, option.method || 'wait', pin.x, pin.y, !option.disabled, look.highlight)
        ui.panel(pin.x - 44, pin.y + 6, 88, 40, {
          fill: option.disabled ? '#101820' : look.fill,
          stroke: option.disabled ? COLORS.line : look.color,
          radius: 8,
          glow: look.highlight ? 'rgba(255,198,92,0.22)' : null
        })
        ui.ctx.textAlign = 'center'
        ui.text(look.highlight ? '索道' : present.plateText(option, look), pin.x, pin.y + 9, 11, option.disabled ? '#6a7a88' : COLORS.text, '700', 80)
        const pip = this.pip(option)
        const cost = option.costText ? present.clip(option.costText, 8) : ''
        ui.text(look.highlight ? '点这里撤' : ([pip, cost].filter(Boolean).join(' ') || look.label), pin.x, pin.y + 24, 10,
          option.disabled ? '#6a7a88' : look.color, '700')
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
    ui.wrapped(present.spot(node) || node.text, rect.x + 58, rect.y + 6, rect.w - 70, {
      size: 14,
      lineHeight: 18,
      maxLines: 2,
      weight: '700',
      color: COLORS.text
    })
    if (node.revealItem) {
      const it = node.revealItem
      stage.drawItemIcon(ui.ctx, rect.x + 14, rect.y + 42, 16, it)
      ui.text(it.name, rect.x + 38, rect.y + 44, 13, COLORS.text, '700', rect.w - 54)
    }
    const listMode = present.useOptionList(node)
    const rowH = present.OPTION_ROW_H
    const rowGap = 8
    const nOpt = (node.options || []).length
    const listNeed = listMode ? nOpt * (rowH + rowGap) - rowGap + 10 : 0
    const listH = listMode ? Math.min(listNeed, Math.max(200, Math.round(rect.h * 0.58))) : 0
    const wall = stage.ROOM_WALL
    const floor = {
      x: rect.x,
      y: rect.y + rect.h * wall,
      w: rect.w,
      h: Math.max(72, rect.h * (1 - wall) - listH)
    }
    const props = present.layoutRoom(node, floor)
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
      stage.drawPropTag(ui.ctx, prop.kind, prop.x, prop.y + 8)
      if (listMode) {
        ui.addHit(prop.x - 28, prop.y - 36, 56, 64, () => activate(option, prop))
        return
      }
      const look = this.optionLook(option)
      const plateY = prop.y + 24
      ui.panel(prop.x - 58, plateY, 116, 52, {
        fill: hot || look.highlight ? look.fill : '#101820',
        stroke: option.disabled ? COLORS.line : look.color,
        radius: 8,
        glow: look.highlight ? `rgba(255,198,92,${0.16 + 0.14 * Math.abs(Math.sin((this.tick || 0) * 0.28))})` : null
      })
      stage.drawToneMark(ui.ctx, look.tone, prop.x - 54, plateY + 8, 18)
      ui.wrapped(present.listTitle(option), prop.x - 32, plateY + 4, 86, {
        size: 12,
        lineHeight: 16,
        maxLines: 2,
        weight: '700',
        color: option.disabled ? '#6a7a88' : COLORS.text
      })
      const pip = this.pip(option)
      const cost = option.costText ? present.clip(option.costText, 10) : ''
      ui.text(look.highlight ? '开索道' : ([pip, cost].filter(Boolean).join(' · ') || look.label), prop.x - 32, plateY + 34, 11,
        option.disabled ? '#6a7a88' : look.color, '700', 86)
      ui.addHit(prop.x - 60, prop.y - 58, 120, 128, () => activate(option, prop))
    })
    if (listMode) {
      this.renderOptionList(ui, {
        x: rect.x + 6,
        y: rect.y + rect.h - listH,
        w: rect.w - 12,
        h: listH
      }, props, hotIdx, activate, listNeed)
    } else {
      this.mainScroll.setBounds(rect.h, rect.h)
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
  },

  renderOptionList(ui, listRect, props, hotIdx, activate, listNeed) {
    const rowH = present.OPTION_ROW_H
    const gap = 8
    this.listRect = listRect
    this.mainScroll.setBounds(listNeed, listRect.h)
    const rows = props.slice().sort((a, b) => Number(present.isLever(b.opt)) - Number(present.isLever(a.opt)))
    ui.panel(listRect.x, listRect.y, listRect.w, listRect.h, {
      fill: 'rgba(8,14,20,0.86)',
      stroke: COLORS.rim,
      radius: 12,
      sheen: false
    })
    ui.withClip(listRect, () => {
      let y = listRect.y + 6 - this.mainScroll.offset
      rows.forEach(prop => {
        const option = prop.opt
        const hot = hotIdx === option.idx
        const look = this.optionLook(option)
        ui.panel(listRect.x + 6, y, listRect.w - 12, rowH, {
          fill: hot || look.highlight ? look.fill : '#101820',
          stroke: option.disabled ? COLORS.line : look.color,
          radius: 10,
          glow: look.highlight ? `rgba(255,198,92,${0.16 + 0.14 * Math.abs(Math.sin((this.tick || 0) * 0.28))})` : null
        })
        stage.drawToneMark(ui.ctx, look.tone, listRect.x + 14, y + 20, 26)
        const risky = present.dangerPip(option)
        const railW = risky ? 64 : 58
        const textW = listRect.w - 56 - railW
        ui.wrapped(present.listTitle(option), listRect.x + 46, y + 8, textW, {
          size: 15,
          lineHeight: 21,
          maxLines: 2,
          weight: '700',
          color: option.disabled ? '#6a7a88' : COLORS.text
        })
        const pip = this.pip(option)
        const railX = listRect.x + listRect.w - railW - 14
        ui.chip(railX, y + 8, railW, 22, look.label, {
          fill: look.fill,
          stroke: look.color,
          color: look.color,
          size: 12
        })
        if (risky) {
          ui.chip(railX, y + 34, 32, 24, '险', {
            fill: '#4a2024',
            stroke: COLORS.danger,
            color: COLORS.danger,
            size: 14
          })
          ui.ctx.textAlign = 'right'
          ui.text(pip, railX + railW, y + 38, 13, COLORS.danger, '700', railW - 36)
          ui.ctx.textAlign = 'left'
        } else {
          ui.ctx.textAlign = 'right'
          ui.text(pip || (look.highlight ? '开索道' : present.propName(option)), railX + railW, y + 38, 12,
            option.disabled ? '#6a7a88' : look.color, '700', railW)
          ui.ctx.textAlign = 'left'
        }
        ui.addHit(listRect.x + 6, y, listRect.w - 12, rowH, () => activate(option, prop))
        y += rowH + gap
      })
    })
    ui.scrollbar(listRect, this.mainScroll)
  },

  renderRunContent(ui, rect) {
    const node = this.run.node
    const options = node.options || []
    const travel = options.filter(opt => present.isTravel(opt))
    const local = options.filter(opt => !present.isTravel(opt))
    const showMap = travel.length > 0 || present.useMap(node)
    const showSite = local.length > 0 || (!showMap && present.useRoom(node))
    if (showMap && showSite) {
      const stripH = present.travelStripH(travel.length)
      const stripRect = { x: rect.x, y: rect.y, w: rect.w, h: stripH }
      this.renderTravelStrip(ui, stripRect, travel, node)
      const siteRect = {
        x: rect.x,
        y: rect.y + stripH + 8,
        w: rect.w,
        h: Math.max(88, rect.h - stripH - 8)
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
    if (present.leverNudge(this.run)) reachable.core = true
    return reachable
  },

  renderTravelStrip(ui, rect, travel, node) {
    ui.panel(rect.x, rect.y, rect.w, rect.h, {
      fill: '#0a141c',
      stroke: '#3d5c74',
      radius: 12,
      sheen: false
    })
    ui.text('去哪', rect.x + 10, rect.y + 6, 11, COLORS.gold, '700')
    const row = travel.length <= 3
    if (row) {
      const gap = 8
      const chipW = (rect.w - 20 - gap * (travel.length - 1)) / travel.length
      travel.forEach((option, i) => {
        const look = this.optionLook(option)
        const x = rect.x + 10 + i * (chipW + gap)
        const y = rect.y + 22
        ui.panel(x, y, chipW, 58, {
          fill: option.disabled ? '#101820' : look.fill,
          stroke: option.disabled ? COLORS.line : look.color,
          radius: 10,
          glow: look.highlight ? 'rgba(255,198,92,0.22)' : null
        })
        ui.text(present.travelLabel(option, node), x + 8, y + 4, 14, option.disabled ? '#6a7a88' : COLORS.text, '700', chipW - 16)
        ui.wrapped(look.highlight ? '合闸开索道' : present.listTitle(option), x + 8, y + 22, chipW - 16, {
          size: 11,
          lineHeight: 15,
          maxLines: 2,
          weight: '700',
          color: option.disabled ? '#6a7a88' : look.color
        })
        ui.addHit(x, y, chipW, 58, () => {
          if (option.disabled) {
            this.messages.unshift(this.pip(option) || '现在不行')
            manager.requestRender()
            return
          }
          this.pick(option.idx)
        })
      })
      return
    }
    travel.forEach((option, i) => {
      const look = this.optionLook(option)
      const y = rect.y + 22 + i * 52
      ui.panel(rect.x + 8, y, rect.w - 16, 48, {
        fill: option.disabled ? '#101820' : look.fill,
        stroke: option.disabled ? COLORS.line : look.color,
        radius: 10,
        glow: look.highlight ? 'rgba(255,198,92,0.22)' : null
      })
      ui.text(present.travelLabel(option, node), rect.x + 16, y + 4, 14, option.disabled ? '#6a7a88' : COLORS.text, '700', rect.w - 36)
      ui.wrapped(present.listTitle(option), rect.x + 16, y + 22, rect.w - 36, {
        size: 12,
        lineHeight: 16,
        maxLines: 1,
        weight: '700',
        color: option.disabled ? '#6a7a88' : look.color
      })
      ui.addHit(rect.x + 8, y, rect.w - 16, 48, () => {
        if (option.disabled) {
          this.messages.unshift(this.pip(option) || '现在不行')
          manager.requestRender()
          return
        }
        this.pick(option.idx)
      })
    })
  },

  pinNeedsPlate(option, look, node) {
    const zoneLabel = present.ZONE_SHORT[present.pinZone(option, node)]
    return !!(option.method || option.wait || look.highlight || look.tone === 'fight' || look.tone === 'safe'
      || (option.verb && option.verb !== zoneLabel))
  },

  renderMapHits(ui, rect, travel, node, readyPins) {
    const pins = readyPins || present.layoutPins(Object.assign({}, node, { options: travel }), rect, true)
    Object.keys(present.ZONE_POS).forEach(key => {
      const p = present.ZONE_POS[key]
      const px = rect.x + p.x * rect.w
      const py = rect.y + p.y * rect.h
      ui.addHit(px - 32, py - 28, 64, 56, () => this.pickZone(key, pins))
    })
    pins.forEach(pin => {
      const option = pin.opt
      const look = this.optionLook(option)
      const extra = this.pinNeedsPlate(option, look, node)
      if (option.method || option.wait) {
        stage.drawPad(ui.ctx, option.method || 'wait', pin.x, pin.y, !option.disabled, look.highlight)
      }
      if (extra) {
        const plate = present.pinPlateBox(pin, rect)
        ui.panel(plate.x, plate.y, plate.w, plate.h, {
          fill: option.disabled ? '#101820' : look.fill,
          stroke: option.disabled ? COLORS.line : look.color,
          radius: 6,
          sheen: false,
          glow: look.highlight ? 'rgba(255,198,92,0.22)' : null
        })
        ui.ctx.textAlign = 'center'
        ui.text(present.plateText(option, look),
          plate.x + plate.w / 2, plate.y + 2, 11,
          option.disabled ? '#6a7a88' : look.color, '700', plate.w - 8)
        ui.ctx.textAlign = 'left'
      }
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
      stage.drawItemIcon(ui.ctx, x + 12, y + 10, 30, item)
      ui.text(item.name, x + 50, y + 12, 14, COLORS.text, '700', w - 64)
      ui.text(`${engine.fmtVal(item.value)} · ${item.weight}格${item.secured ? ' · 已入匣' : ''}`,
        x + 50, y + 36, 12, item.secured ? COLORS.accent : COLORS.muted)
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
    this.listRect = null
    const contentTop = this.renderHud(ui, v)
    const toolbarH = 70
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
    const y = v.safe.bottom - 60
    const gap = 8
    const bw = (width - gap * 2) / 3
    const medEnabled = this.run.meds > 0 && this.run.hp < 100 && !this.run.ended
    const bagHot = this.pickup && Date.now() < this.pickupUntil
    const medHot = medEnabled && this.run.hp < 60
    const extractOn = engine.canExtractNow(this.run) && !this.run.ended
    const extractHot = extractOn && (this.run.hp < 60 || this.run.risk >= 70 || this.run.levers >= 2)
    ui.button(left, y, bw, 52, this.bagOpen ? '关闭' : `背包 ${this.run.loot.length}`,
      () => this.toggleBag(), {
        size: 15,
        fill: this.bagOpen ? '#1e4f43' : (bagHot ? '#3a2e16' : '#121c28'),
        stroke: bagHot ? COLORS.gold : '#4a7190',
        color: bagHot ? COLORS.gold : COLORS.text
      })
    ui.button(left + bw + gap, y, bw, 52,
      `打药 ${this.run.meds}`, () => this.useMed(), {
        size: 15,
        enabled: medEnabled,
        fill: medHot ? '#3a2a16' : '#12241c',
        stroke: medHot ? COLORS.gold : '#4a7190',
        color: medHot ? COLORS.gold : COLORS.accent
      })
    ui.button(left + (bw + gap) * 2, y, bw, 52, '撤离', () => this.goExtract(), {
      size: 15,
      enabled: extractOn,
      fill: extractHot ? '#2a2410' : '#121c28',
      stroke: extractHot ? COLORS.gold : '#4a7190',
      color: extractHot ? COLORS.gold : COLORS.text
    })

    if (this.run.risk >= 55) {
      const danger = Math.min(0.28, (this.run.risk - 55) / 180)
      ui.ctx.fillStyle = `rgba(90,12,18,${danger})`
      ui.ctx.fillRect(0, 0, v.width, 28)
      ui.ctx.fillRect(0, v.height - 36, v.width, 36)
    }

    this.renderPickup(ui, v)
    this.renderJuice(ui, v)
    this.renderLesson(ui, v)
    this.renderEnding(ui, v)
  },

  juiceLook(kind) {
    if (kind === 'bad' || kind === 'hit' || kind === 'dead') {
      return { ok: false, fill: '#2c171b', stroke: COLORS.danger, glow: 'rgba(255,107,107,0.22)', color: '#ffd0d0' }
    }
    if (kind === 'loot' || kind === 'lever' || kind === 'win') {
      return { ok: true, fill: '#2a2410', stroke: COLORS.gold, glow: 'rgba(255,198,92,0.24)', color: COLORS.gold }
    }
    if (kind === 'extract') {
      return { ok: true, fill: '#15273a', stroke: COLORS.blue, glow: 'rgba(101,169,255,0.22)', color: COLORS.ice }
    }
    return { ok: true, fill: '#132820', stroke: COLORS.accent, glow: 'rgba(101,214,180,0.22)', color: COLORS.accent }
  },

  renderJuice(ui, v) {
    if (!this.juice || Date.now() > this.juice.until) return
    if (this.pickup && Date.now() < this.pickupUntil) return
    const left = Math.max(0, this.juice.until - Date.now())
    const t = 1 - left / 1100
    const scale = 1.18 - t * 0.26
    const look = this.juiceLook(this.juice.kind || this.juice.mark)
    const fail = look.ok === false
    const w = Math.min(fail ? 260 : 236, v.safe.right - v.safe.left - 40)
    const x = (v.width - w) / 2
    const y = v.height * 0.24
    const h = this.juice.sub ? 96 : 80
    ui.panel(x, y, w, h, {
      fill: look.fill,
      stroke: look.stroke,
      radius: 16,
      glow: look.glow,
      rim: look.stroke
    })
    stage.drawStamp(ui.ctx, this.juice.kind || this.juice.mark, x + 40, y + h / 2, (fail ? 18 : 16) * scale)
    ui.text(this.juice.label, x + 70, y + (this.juice.sub ? 16 : 24), fail ? 28 : 22, look.color, '700', w - 88)
    if (this.juice.sub) ui.text(this.juice.sub, x + 70, y + 52, 15, fail ? '#ffd0d0' : COLORS.body, '700', w - 88)
  },

  renderLesson(ui, v) {
    if (!this.lessonOpen || this.bagOpen) return
    const card = present.lesson(this.run)
    const w = Math.min(320, v.safe.right - v.safe.left - 28)
    const x = (v.width - w) / 2
    const y = v.safe.top + 86
    ui.ctx.fillStyle = 'rgba(5,10,16,0.55)'
    ui.ctx.fillRect(0, 0, v.width, v.height)
    ui.panel(x, y, w, 168, {
      fill: '#162018',
      stroke: COLORS.gold,
      radius: 14,
      glow: 'rgba(255,198,92,0.28)',
      rim: COLORS.gold
    })
    ui.text(card.title, x + 16, y + 12, 20, COLORS.gold, '700', w - 32)
    ui.text(card.cue, x + 16, y + 40, 14, COLORS.text, '700', w - 32)
    stage.drawLessonRail(ui.ctx, { x: x + 16, y: y + 68, w: w - 32, h: 28 }, card.steps, this.tick)
    ui.button(x + 16, y + 112, w - 32, 40, card.kind === 'cable' ? '知道了，点索道' : '知道了，去合闸', () => this.dismissLesson(), {
      fill: '#d4a017',
      stroke: '#ffe08a',
      color: '#1a1408',
      size: 16,
      weight: '700'
    })
    ui.addHit(0, 0, v.width, v.height, () => this.dismissLesson())
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
    ui.panel(x, y, w, 88, {
      fill: hot ? '#2c1c14' : '#132820',
      stroke: hot ? COLORS.gold : COLORS.accent,
      radius: 14,
      glow: hot ? 'rgba(255,198,92,0.22)' : 'rgba(101,214,180,0.18)',
      rim: hot ? COLORS.gold : COLORS.accent
    })
    stage.drawJudge(ui.ctx, true, x + 28, y + 32, 12)
    stage.drawItemIcon(ui.ctx, x + 48, y + 28, 24, item)
    ui.text('入手', x + 82, y + 12, 13, COLORS.gold, '700')
    ui.text(item.name, x + 82, y + 32, 16, COLORS.text, '700', w - 98)
    ui.text(engine.fmtVal(item.value), x + 82, y + 56, 13, COLORS.accent, '700')
  }
})
