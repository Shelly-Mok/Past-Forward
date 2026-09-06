'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Phase = 'idle' | 'door-opening' | 'boarding' | 'sealing' | 'launch' | 'transit' | 'arrived';
type Flower = { id: string; portId: string; age: string; x: number; y: number };
type Planet = { id: string; portId: string; label: string; x: number; y: number };
type WebMcpContext = {
  registerTool: (tool: {
    name: string;
    title: string;
    description: string;
    inputSchema: Record<string, unknown>;
    annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
    execute: (input: unknown) => unknown;
  }, options: { signal: AbortSignal }) => void | Promise<void>;
};

const FLOWERS: Flower[] = [
  { id: 'flower-00', portId: 'PF-FLOWER-00', age: '0岁', x: 31.7, y: 68.4 },
  { id: 'flower-05', portId: 'PF-FLOWER-05', age: '5岁', x: 38.3, y: 68.1 },
  { id: 'flower-10', portId: 'PF-FLOWER-10', age: '10岁', x: 44.8, y: 65.9 },
  { id: 'flower-15', portId: 'PF-FLOWER-15', age: '15岁', x: 51.2, y: 65.4 },
  { id: 'flower-18', portId: 'PF-FLOWER-18', age: '18岁', x: 55.2, y: 65.4 },
  { id: 'flower-20', portId: 'PF-FLOWER-20', age: '20岁', x: 58.1, y: 65.2 },
];

const PLANETS: Planet[] = [
  { id: 'planet-return', portId: 'PF-PLANET-RETURN', label: '回溯', x: 28.7, y: 36.3 },
  { id: 'planet-forward', portId: 'PF-PLANET-FORWARD', label: '前进', x: 47.5, y: 28.9 },
  { id: 'planet-future', portId: 'PF-PLANET-FUTURE', label: '前瞻', x: 65.4, y: 25.3 },
  { id: 'planet-ending', portId: 'PF-PLANET-ENDING', label: '结束', x: 84.1, y: 29.1 },
];

const PHASE_COPY: Record<Phase, string> = {
  idle: '选择一朵花，开启穿梭',
  'door-opening': '舱门开启',
  boarding: '正在登舱',
  sealing: '舱门闭合',
  launch: '离开月面',
  transit: '接近时间星球',
  arrived: '选择下一段旅程',
};

function emit(name: string, detail: Record<string, unknown>) {
  window.dispatchEvent(new CustomEvent(name, { detail: { ...detail, timestamp: Date.now() } }));
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [selectedFlower, setSelectedFlower] = useState<Flower | null>(null);
  const timers = useRef<number[]>([]);
  const phaseRef = useRef<Phase>('idle');

  const clearTimeline = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  }, []);

  const changePhase = useCallback((next: Phase, flower?: Flower | null) => {
    phaseRef.current = next;
    setPhase(next);
    emit('pf:flight-phase', { phase: next, sourcePortId: flower?.portId ?? null });
  }, []);

  const reset = useCallback(() => {
    clearTimeline();
    setSelectedFlower(null);
    changePhase('idle');
    emit('pf:journey-reset', { phase: 'idle' });
  }, [changePhase, clearTimeline]);

  const beginJourney = useCallback((flower: Flower) => {
    if (phaseRef.current !== 'idle') return;
    clearTimeline();
    setSelectedFlower(flower);
    emit('pf:flower-selected', { flowerId: flower.id, portId: flower.portId, age: flower.age });
    changePhase('door-opening', flower);
    const queue = (delay: number, next: Phase) => {
      timers.current.push(window.setTimeout(() => {
        changePhase(next, flower);
        if (next === 'arrived') {
          emit('pf:arrival-ready', {
            sourcePortId: flower.portId,
            planetPortIds: PLANETS.map((planet) => planet.portId),
          });
        }
      }, delay));
    };
    queue(850, 'boarding');
    queue(2450, 'sealing');
    queue(3250, 'launch');
    queue(5150, 'transit');
    queue(7500, 'arrived');
  }, [changePhase, clearTimeline]);

  const selectPlanet = useCallback((planet: Planet) => {
    if (phaseRef.current !== 'arrived') return;
    emit('pf:planet-selected', {
      planetId: planet.id,
      portId: planet.portId,
      label: planet.label,
      sourcePortId: selectedFlower?.portId ?? null,
    });
  }, [selectedFlower]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r') reset();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearTimeline();
    };
  }, [clearTimeline, reset]);

  useEffect(() => {
    const api = {
      version: '1.0.0',
      startFromFlower: (idOrPortId: string) => {
        const flower = FLOWERS.find((item) => item.id === idOrPortId || item.portId === idOrPortId);
        if (!flower) return false;
        beginJourney(flower);
        return true;
      },
      selectPlanet: (idOrPortId: string) => {
        const planet = PLANETS.find((item) => item.id === idOrPortId || item.portId === idOrPortId);
        if (!planet || phaseRef.current !== 'arrived') return false;
        selectPlanet(planet);
        return true;
      },
      reset,
      getState: () => ({ phase: phaseRef.current, sourcePortId: selectedFlower?.portId ?? null }),
    };
    Object.assign(window, { PastForwardJourney: api });
    emit('pf:interface-ready', { version: api.version });
    return () => { delete (window as Window & { PastForwardJourney?: unknown }).PastForwardJourney; };
  }, [beginJourney, reset, selectPlanet, selectedFlower]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: WebMcpContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Parameters<WebMcpContext['registerTool']>[0]) => {
      try {
        void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(console.error);
      } catch (error) { console.error(error); }
    };
    register({
      name: 'start_moon_journey',
      title: '从月面花朵出发',
      description: '选择一个花朵接口并启动完整的登舱与飞行动画。仅可在 idle 状态调用。',
      inputSchema: {
        type: 'object', properties: { portId: { type: 'string', enum: FLOWERS.map((item) => item.portId) } },
        required: ['portId'], additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const portId = (input as { portId?: unknown })?.portId;
        const flower = FLOWERS.find((item) => item.portId === portId);
        if (!flower) throw new Error('未知花朵接口');
        if (phaseRef.current !== 'idle') throw new Error(`当前阶段 ${phaseRef.current} 不允许重新出发`);
        beginJourney(flower);
        return { accepted: true, sourcePortId: flower.portId, phase: 'door-opening' };
      },
    });
    register({
      name: 'select_time_planet',
      title: '选择时间星球',
      description: '动画抵达后选择一个星球接口，派发后续工程可监听的选择事件。',
      inputSchema: {
        type: 'object', properties: { portId: { type: 'string', enum: PLANETS.map((item) => item.portId) } },
        required: ['portId'], additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const portId = (input as { portId?: unknown })?.portId;
        const planet = PLANETS.find((item) => item.portId === portId);
        if (!planet) throw new Error('未知星球接口');
        if (phaseRef.current !== 'arrived') throw new Error('尚未抵达星球选择阶段');
        selectPlanet(planet);
        return { selected: true, portId: planet.portId, label: planet.label };
      },
    });
    return () => lifecycle.abort();
  }, [beginJourney, selectPlanet]);

  const isRunning = phase !== 'idle';
  const isSpace = phase === 'transit' || phase === 'arrived';

  return (
    <main className={`experience phase-${phase}`} data-phase={phase}>
      <div className="stage" aria-label="月面时间穿梭交互场景">
        <div className="scene scene-moon-sky" aria-hidden={isSpace}>
          <img src="/穿梭_1_干净月面.png" alt="星空、左上角月球与六朵时间之花" />
        </div>
        <div className="scene scene-moon-surface" aria-hidden={isSpace}>
          <img src="/穿梭_1_干净月面.png" alt="月球表面" />
        </div>

        <div className="moon-effects" aria-hidden="true">
          <span className="hatch-light" />
          <span className="hatch-door" />
          <span className="astronaut-sprite" />
          <span className="landed-ship-body" />
          <span className="landing-gear landing-gear-left" />
          <span className="landing-gear landing-gear-ladder" />
          <span className="landing-gear landing-gear-right" />
          <span className="flying-ship" />
        </div>

        <div className="planet-seeds" aria-hidden="true">
          {PLANETS.map((planet) => (
            <span
              className="planet-seed"
              key={`seed-${planet.portId}`}
              style={{
                left: `${planet.x}%`,
                top: `${planet.y}%`,
                backgroundPosition: `${(planet.x - 6) / 0.88}% ${(planet.y - 7) / 0.86}%`,
              }}
            />
          ))}
        </div>

        <div className="scene scene-space" aria-hidden={!isSpace}>
          <img src="/穿梭_2.png" alt="飞船抵达四颗时间星球之间" />
        </div>

        <section className="flower-ports" aria-label="月面花朵接口">
          {FLOWERS.map((flower) => (
            <button className="port flower-port" data-port-id={flower.portId} disabled={isRunning}
              key={flower.portId} onClick={() => beginJourney(flower)}
              style={{ left: `${flower.x}%`, top: `${flower.y}%` }}
              title={`${flower.age} · ${flower.portId}`} type="button">
              <span className="sr-only">从{flower.age}的花朵开始穿梭</span>
            </button>
          ))}
        </section>

        <section className="planet-ports" aria-label="时间星球接口" aria-hidden={!isSpace}>
          {PLANETS.map((planet) => (
            <button className="port planet-port" data-port-id={planet.portId} disabled={phase !== 'arrived'}
              key={planet.portId} onClick={() => selectPlanet(planet)}
              style={{ left: `${planet.x}%`, top: `${planet.y}%` }}
              title={`${planet.label} · ${planet.portId}`} type="button">
              <span className="sr-only">选择{planet.label}星球</span>
            </button>
          ))}
        </section>

        <div className="status" role="status" aria-live="polite">
          <span className="status-dot" />
          <span>{PHASE_COPY[phase]}</span>
          {selectedFlower && phase !== 'idle' ? <small>{selectedFlower.age}</small> : null}
        </div>

        <button className="reset" onClick={reset} type="button" aria-label="重新进入月面">
          <kbd>R</kbd><span>重新进入画面</span>
        </button>
      </div>
    </main>
  );
}
