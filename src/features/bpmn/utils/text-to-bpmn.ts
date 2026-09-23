export const FLOW_TEXT_EXAMPLE = `raia Solicitante
receber solicitação
raia Compras
? documentos completos
  sim: usuario: analisar mérito
  não: pedir complemento
    -> receber solicitação
raia Financeiro
emitir parecer
fim`;

const MAX_STEPS = 80;
const MAX_NAME = 160;
const GAP_X = 80;
const GAP_Y = 48;
const EVENT = { w: 36, h: 36 };
const TASK = { w: 150, h: 80 };
const GATEWAY = { w: 50, h: 50 };

const TASK_PREFIXES: Record<string, TaskKind> = {
  usuario: "userTask",
  usuário: "userTask",
  user: "userTask",
  servico: "serviceTask",
  serviço: "serviceTask",
  sistema: "serviceTask",
  manual: "manualTask",
  regra: "businessRuleTask",
  envio: "sendTask",
  enviar: "sendTask",
  recebimento: "receiveTask",
  receber: "receiveTask",
  script: "scriptTask",
  tarefa: "task",
};

type TaskKind = "task" | "userTask" | "serviceTask" | "manualTask" | "businessRuleTask" | "sendTask" | "receiveTask" | "scriptTask";
type GatewayMode = "exclusive" | "parallel";

type FlowStep = { lane: string | null } & (
  | { type: "start"; name: string; line: number }
  | { type: "end"; name: string; line: number }
  | { type: "task"; name: string; task: TaskKind; line: number; doc?: string }
  | { type: "goto"; target: string; line: number }
  | { type: "gateway"; mode: GatewayMode; name: string; line: number; branches: FlowBranch[] }
);

const FLOW_LABELS = new Set(["sim", "não", "nao", "yes", "no", "s", "n"]);
const ACTOR_VERBS = new Set([
  "envia", "enviam", "recebe", "recebem", "analisa", "analisam", "aprova", "aprovam", "solicita", "solicitam",
  "realiza", "realizam", "efetua", "efetuam", "verifica", "verificam", "confere", "conferem", "emite", "emitem",
  "registra", "registram", "cadastra", "cadastram", "valida", "validam", "encaminha", "encaminham", "devolve",
  "devolvem", "paga", "pagam", "autoriza", "autorizam", "prepara", "preparam", "elabora", "elaboram", "revisa",
  "revisam", "arquiva", "arquivam", "protocola", "protocolam", "consulta", "consultam", "calcula", "calculam",
  "homologa", "homologam", "contrata", "contratam", "publica", "publicam", "notifica", "notificam", "comunica",
  "comunicam", "assina", "assinam", "despacha", "despacham", "executa", "executam", "avalia", "avaliam",
  "deve", "devem", "precisa", "precisam", "vai", "vão", "ira", "irá", "irão",
]);

let activeLane: string | null = null;

interface FlowBranch {
  label: string;
  steps: FlowStep[];
  line: number;
}

interface RawLine {
  number: number;
  indent: number;
  text: string;
}

interface Shape {
  id: string;
  tag: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  incoming: string[];
  outgoing: string[];
  lane: string | null;
  doc?: string;
}

interface LaneBand {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  nodes: string[];
}

interface Flow {
  id: string;
  source: string;
  target: string;
  name?: string;
  waypoints: Array<{ x: number; y: number }>;
}

interface Incoming {
  id: string;
  label?: string;
}

export function buildDiagramFromText(source: string): { xml: string; text: string } | { error: string } {
  activeLane = null;
  try {
    const lines = tokenize(organizeCatalog(source) ?? source);
    if (lines.length === 0) {
      return { error: "Escreva ao menos um passo." };
    }

    const parsed = parseSequence(lines, 0, 0);
    const repaired = trimFlow(repairFlow(parsed.steps, true), { left: MAX_STEPS });
    if (repaired.length === 0) {
      return { error: "Escreva ao menos um passo." };
    }

    const steps = repaired[0]?.type === "start" ? repaired : [{ type: "start" as const, name: "Início", line: 0, lane: null }, ...repaired];
    propagateLanes(steps);
    return { xml: render(layout(steps)), text: formatSteps(repaired, 0, { lane: null }).join("\n") };
  } catch {
    return { error: "Não foi possível modelar esse texto." };
  }
}

function tokenize(source: string): RawLine[] {
  return source.split(/\r?\n/).flatMap((raw, index) => {
    const expanded = raw.replace(/\t/g, "  ");
    const text = expanded.trim();
    if (!text || text.startsWith("#")) {
      return [];
    }

    const indent = expanded.match(/^ */)?.[0].length ?? 0;
    return [{ number: index + 1, indent, text }];
  });
}

function parseSequence(lines: RawLine[], index: number, indent: number, previous: FlowStep | null = null): { steps: FlowStep[]; index: number } {
  const steps: FlowStep[] = [];

  while (index < lines.length && lines[index].indent >= indent) {
    if (lines[index].indent > indent) {
      lines[index] = { ...lines[index], indent };
    }

    const peeled = peelDoc(lines[index].text);
    if (peeled.text.startsWith(">")) {
      const note = peeled.text.slice(1).trim();
      const target = steps[steps.length - 1] ?? previous;
      if (target?.type === "task" && note) {
        target.doc = target.doc ? `${target.doc} ${note}` : note;
      }
      index += 1;
      continue;
    }

    const marked = applyLane(peeled.text);
    if (marked.consumed) {
      index += 1;
      continue;
    }

    if (marked.text !== lines[index].text) {
      lines[index] = { ...lines[index], text: marked.text };
    }

    const parsed = parseStepAt(lines, index, indent);
    if (peeled.doc && parsed.step.type === "task") {
      parsed.step.doc = peeled.doc;
    }
    steps.push(parsed.step);
    index = parsed.index;

    if ((parsed.step.type === "goto" || parsed.step.type === "end") && indent > 0 && index < lines.length && lines[index].indent >= indent) {
      lines[index] = { ...lines[index], indent: indent - 2 };
      break;
    }
  }

  return { steps, index };
}

function parseStepAt(lines: RawLine[], index: number, indent: number): { step: FlowStep; index: number } {
  const line = lines[index];
  const gateway = parseGateway(line);
  if (!gateway) {
    return { step: parseSimpleText(line.text, line.number), index: index + 1 };
  }

  let cursor = index + 1;
  const branches: FlowBranch[] = [];
  const laneBefore = activeLane;
  let stickyLane: string | null = null;

  if (cursor < lines.length && lines[cursor].indent > line.indent) {
    const branchIndent = lines[cursor].indent;
    while (cursor < lines.length && lines[cursor].indent >= branchIndent) {
      if (lines[cursor].indent > branchIndent) {
        if (branches.length === 0) {
          lines[cursor] = { ...lines[cursor], indent: branchIndent };
        } else {
          const continuation = parseSequence(lines, cursor, lines[cursor].indent);
          branches[branches.length - 1]?.steps.push(...continuation.steps);
          cursor = continuation.index;
          continue;
        }
      }

      activeLane = stickyLane ?? laneBefore;
      stickyLane = null;
      const current = lines[cursor];
      if (current.text.trim().startsWith(">")) {
        const note = current.text.trim().slice(1).trim();
        const branch = branches[branches.length - 1];
        const last = branch?.steps[branch.steps.length - 1];
        if (last?.type === "task" && note) {
          last.doc = last.doc ? `${last.doc} ${note}` : note;
        }
        cursor += 1;
        continue;
      }

      const peeled = peelDoc(current.text);
      const marked = applyLane(peeled.text, false);
      if (marked.consumed) {
        stickyLane = activeLane;
        cursor += 1;
        continue;
      }

      const split = splitLabel(marked.text);
      if (!split && parseGateway({ ...current, text: marked.text })) {
        lines[cursor] = { ...current, text: marked.text };
        const nestedGateway = parseStepAt(lines, cursor, branchIndent);
        branches.push({ label: "", steps: [nestedGateway.step], line: current.number });
        cursor = nestedGateway.index;
        continue;
      }

      let label = "";
      let first: FlowStep | null = null;
      if (split && !split.rest) {
        label = split.label;
        cursor += 1;
      } else if (split) {
        label = split.label;
        first = parseSimpleText(split.rest, current.number);
        cursor += 1;
      } else {
        first = parseSimpleText(marked.text, current.number);
        cursor += 1;
      }

      if (first?.type === "task" && peeled.doc) {
        first.doc = peeled.doc;
      }

      let nested: FlowStep[] = [];
      if (cursor < lines.length && lines[cursor].indent > branchIndent) {
        const nestedIndent = lines[cursor].indent;
        const sequence = parseSequence(lines, cursor, nestedIndent, first);
        nested = sequence.steps;
        cursor = sequence.index;
      }

      const branchSteps = first ? [first, ...nested] : nested;
      if (branchSteps.length === 0) {
        continue;
      }

      branches.push({ label, steps: branchSteps, line: current.number });
    }
  }

  activeLane = laneBefore;

  return {
    step: { type: "gateway", mode: gateway.mode, name: gateway.name, line: line.number, branches, lane: laneBefore },
    index: cursor,
  };
}

function parseGateway(line: RawLine): { mode: GatewayMode; name: string } | null {
  if (line.text.startsWith("?")) {
    return { mode: "exclusive", name: cleanName(line.text.slice(1), "Decisão") };
  }

  if (line.text.startsWith("+")) {
    return { mode: "parallel", name: cleanName(line.text.slice(1), "Paralelo") };
  }

  if (line.text.endsWith("?") && !line.text.includes(":")) {
    return { mode: "exclusive", name: cleanName(line.text.slice(0, -1), "Decisão") };
  }

  return null;
}

function splitLabel(text: string): { label: string; rest: string } | null {
  const index = text.indexOf(":");
  if (index <= 0) {
    return null;
  }

  const label = text.slice(0, index).trim();
  if (!label || TASK_PREFIXES[normalize(label)]) {
    return null;
  }

  return { label, rest: text.slice(index + 1).trim() };
}

function parseSimpleText(text: string, line: number): FlowStep {
  const marked = applyLane(text, false);
  const source = marked.consumed ? "" : marked.text;
  const normalized = normalize(source);
  const lane = activeLane;
  if (!source) {
    return { type: "task", name: "Passo", task: "task", line, lane };
  }

  if (normalized === "inicio" || normalized === "início" || normalized.startsWith("inicio:") || normalized.startsWith("início:")) {
    const name = source.includes(":") ? cleanName(source.slice(source.indexOf(":") + 1), "Início") : "Início";
    return { type: "start", name, line, lane };
  }

  if (normalized === "fim" || normalized.startsWith("fim:")) {
    const name = source.includes(":") ? cleanName(source.slice(source.indexOf(":") + 1), "Fim") : "Fim";
    return { type: "end", name, line, lane };
  }

  if (source.startsWith("->")) {
    const target = cleanName(source.slice(2), "");
    if (!target) {
      return { type: "end", name: "Fim", line, lane };
    }
    return { type: "goto", target, line, lane };
  }

  if (source.startsWith("?") || source.startsWith("+")) {
    return { type: "task", name: cleanName(source.slice(1), "Decisão"), task: "task", line, lane };
  }

  const typed = matchTyped(source, line);
  if (typed) {
    return { type: "task", name: typed.name, task: typed.task, line, lane };
  }

  return { type: "task", name: cleanName(source, "Passo"), task: "task", line, lane };
}

function matchTyped(text: string, line: number): { name: string; task: TaskKind } | null {
  const index = text.indexOf(":");
  if (index <= 0) {
    return null;
  }

  const prefix = normalize(text.slice(0, index).trim());
  const task = TASK_PREFIXES[prefix];
  if (!task) {
    return null;
  }

  return { task, name: cleanName(text.slice(index + 1), "Tarefa") };
}

function applyLane(text: string, role = true): { consumed: boolean; text: string } {
  const trimmed = text.trim();
  const header = trimmed.match(/^(?:raia|lane)\s+(.+)$/i) ?? trimmed.match(/^(?:setor|unidade|área|area|responsável|responsavel)\s*:\s*([^:]+)$/i);
  if (header?.[1]) {
    activeLane = titleLane(header[1]);
    return { consumed: true, text: "" };
  }

  const bracket = trimmed.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (bracket) {
    activeLane = titleLane(bracket[1]);
    return { consumed: !bracket[2].trim(), text: bracket[2].trim() };
  }

  const spoken = readActor(trimmed);
  if (spoken) {
    activeLane = spoken.lane;
    return { consumed: false, text: spoken.action };
  }

  const colon = role ? trimmed.match(/^([^:?+][^:]{0,80}?):\s+(.+)$/) : null;
  if (colon && !TASK_PREFIXES[normalize(colon[1])] && !FLOW_LABELS.has(normalize(colon[1])) && colon[1].trim().split(/\s+/).length <= 4) {
    activeLane = titleLane(colon[1]);
    return { consumed: false, text: colon[2].trim() };
  }

  return { consumed: false, text: trimmed };
}

function readActor(text: string): { lane: string; action: string } | null {
  if (/[?:]/.test(text) || text.startsWith("+") || text.startsWith("->") || text.startsWith("[")) {
    return null;
  }

  const words = text.split(/\s+/);
  for (let index = 1; index < words.length; index += 1) {
    const token = words[index]?.toLocaleLowerCase("pt-BR").replace(/[.,;]+$/, "") ?? "";
    if (!ACTOR_VERBS.has(token)) {
      continue;
    }

    const actor = words.slice(0, index).join(" ");
    if (actor.split(/\s+/).length > 6) {
      return null;
    }

    const action = words
      .slice(index)
      .join(" ")
      .replace(/^(?:deve|devem|precisa|precisam|vai|vão|irá|ira|irão)\s+/i, "");
    return { lane: titleLane(actor), action: action || words.slice(index).join(" ") };
  }

  return null;
}

function titleLane(value: string): string {
  const stripped = cleanName(value, "Geral").replace(/^(?:o|a|os|as)\s+/i, "");
  return stripped.charAt(0).toLocaleUpperCase("pt-BR") + stripped.slice(1);
}

function propagateLanes(steps: FlowStep[]) {
  let current: string | null = null;

  function visit(list: FlowStep[], inherited: string | null) {
    let lane = inherited;
    for (const step of list) {
      if (step.lane) {
        lane = step.lane;
      } else if (lane) {
        step.lane = lane;
      }

      if (step.lane) {
        current = step.lane;
      }

      if (step.type === "gateway") {
        step.branches.forEach((branch) => visit(branch.steps, step.lane));
      }
    }
  }

  visit(steps, null);
  if (steps[0]?.type === "start" && !steps[0].lane) {
    const next = steps.find((step, index) => index > 0 && step.lane);
    if (next?.lane) {
      steps[0].lane = next.lane;
    }
  }

  if (!current) {
    return;
  }

  function fill(list: FlowStep[], inherited: string | null) {
    let lane = inherited ?? current;
    for (const step of list) {
      if (!step.lane && lane) {
        step.lane = lane;
      }
      if (step.lane) {
        lane = step.lane;
      }
      if (step.type === "gateway") {
        step.branches.forEach((branch) => fill(branch.steps, step.lane));
      }
    }
  }

  fill(steps, steps[0]?.lane ?? current);
}

function cleanName(value: string, fallback: string): string {
  const name = value.trim().replace(/\s+/g, " ");
  if (!name) {
    return fallback;
  }

  return name.length > MAX_NAME ? name.slice(0, MAX_NAME).trim() : name;
}

function repairFlow(steps: FlowStep[], root: boolean): FlowStep[] {
  const repaired: FlowStep[] = [];

  steps.forEach((step, index) => {
    if (step.type === "start" && !(root && index === 0)) {
      repaired.push({ type: "task", name: step.name, task: "task", line: step.line, lane: step.lane });
      return;
    }

    if (step.type !== "gateway") {
      repaired.push(step);
      return;
    }

    const branches = step.branches
      .map((branch) => ({ ...branch, steps: repairFlow(branch.steps, false) }))
      .filter((branch) => branch.steps.length > 0);

    if (branches.length < 2) {
      repaired.push({ type: "task", name: step.name, task: "task", line: step.line, lane: step.lane });
      branches.forEach((branch) => repaired.push(...branch.steps));
      return;
    }

    repaired.push({ ...step, branches });
  });

  return repaired;
}

function trimFlow(steps: FlowStep[], budget: { left: number }): FlowStep[] {
  const kept: FlowStep[] = [];

  for (const step of steps) {
    if (budget.left <= 0) {
      break;
    }

    if (step.type === "goto") {
      kept.push(step);
      continue;
    }

    budget.left -= 1;
    if (step.type !== "gateway") {
      kept.push(step);
      continue;
    }

    const branches = step.branches
      .map((branch) => ({ ...branch, steps: trimFlow(branch.steps, budget) }))
      .filter((branch) => branch.steps.length > 0);
    if (branches.length < 2) {
      branches.forEach((branch) => kept.push(...branch.steps));
      continue;
    }

    kept.push({ ...step, branches });
  }

  return kept;
}

function formatSteps(steps: FlowStep[], depth: number, cursor: { lane: string | null }): string[] {
  const pad = "  ".repeat(depth);
  const lines: string[] = [];

  for (const step of steps) {
    if (step.type === "start" && step.line === 0) {
      continue;
    }

    if (depth === 0 && step.lane && step.lane !== cursor.lane) {
      lines.push(`raia ${step.lane}`);
      cursor.lane = step.lane;
    }

    if (step.type !== "gateway") {
      lines.push(pad + formatStep(step, depth, cursor));
      lines.push(...formatDoc(step, pad));
      continue;
    }

    lines.push(pad + formatStep(step, depth, cursor));
    for (const branch of step.branches) {
      const [first, ...rest] = branch.steps;
      if (!first) {
        continue;
      }

      if (branch.label && first.type !== "gateway") {
        lines.push(`${pad}  ${branch.label}: ${formatStep(first, depth + 1, cursor)}`);
        lines.push(...formatDoc(first, `${pad}    `));
        lines.push(...formatSteps(rest, depth + 2, cursor));
        continue;
      }

      if (branch.label) {
        lines.push(`${pad}  ${branch.label}:`);
        lines.push(...formatSteps(branch.steps, depth + 2, cursor));
        continue;
      }

      lines.push(...formatSteps(branch.steps, depth + 1, cursor));
    }
  }

  return lines;
}

function formatStep(step: FlowStep, depth: number, cursor: { lane: string | null }): string {
  const body = formatStepBody(step);
  if (!step.lane || depth === 0 || step.lane === cursor.lane) {
    if (step.lane) {
      cursor.lane = step.lane;
    }
    return body;
  }

  cursor.lane = step.lane;
  return `[${step.lane}] ${body}`;
}

function formatStepBody(step: FlowStep): string {
  if (step.type === "start") {
    return step.name === "Início" ? "início" : `início: ${step.name}`;
  }

  if (step.type === "end") {
    return step.name === "Fim" ? "fim" : `fim: ${step.name}`;
  }

  if (step.type === "goto") {
    return `-> ${step.target}`;
  }

  if (step.type === "gateway") {
    return `${step.mode === "parallel" ? "+" : "?"} ${step.name}`;
  }

  const prefix: Record<TaskKind, string> = {
    task: "",
    userTask: "usuario: ",
    serviceTask: "servico: ",
    manualTask: "manual: ",
    businessRuleTask: "regra: ",
    sendTask: "envio: ",
    receiveTask: "recebimento: ",
    scriptTask: "script: ",
  };
  return `${prefix[step.task]}${step.name}`;
}

function formatDoc(step: FlowStep, pad: string): string[] {
  if (step.type !== "task" || !step.doc) {
    return [];
  }

  return [`${pad}> ${step.doc}`];
}

function sequenceHeight(steps: FlowStep[]): number {
  return steps.reduce((height, step) => Math.max(height, stepHeight(step)), EVENT.h);
}

function stepHeight(step: FlowStep): number {
  if (step.type === "task") {
    return TASK.h;
  }

  if (step.type === "gateway") {
    const branches = step.branches.map((branch) => sequenceHeight(branch.steps));
    const stack = branches.reduce((sum, height) => sum + height, 0) + GAP_Y * (branches.length - 1);
    return Math.max(GATEWAY.h, stack);
  }

  if (step.type === "goto") {
    return EVENT.h;
  }

  return EVENT.h;
}

function layout(steps: FlowStep[]): { nodes: Shape[]; flows: Flow[]; lanes: LaneBand[] } {
  const nodes: Shape[] = [];
  const flows: Flow[] = [];
  const names = new Map<string, string[]>();
  const pending: Array<{ sourceId: string; label?: string; target: string; line: number }> = [];
  let shapeCount = 0;
  let flowCount = 0;

  function addShape(tag: string, name: string, x: number, centerY: number, w: number, h: number, lane: string | null, doc?: string): Shape {
    shapeCount += 1;
    const shape: Shape = {
      id: `${tag === "startEvent" ? "StartEvent" : tag === "endEvent" ? "EndEvent" : tag === "exclusiveGateway" || tag === "parallelGateway" ? "Gateway" : "Activity"}_${shapeCount}`,
      tag,
      name,
      x: Math.round(x),
      y: Math.round(centerY - h / 2),
      w,
      h,
      incoming: [],
      outgoing: [],
      lane,
      doc,
    };
    nodes.push(shape);
    const key = normalize(name);
    const ids = names.get(key) ?? [];
    ids.push(shape.id);
    names.set(key, ids);
    return shape;
  }

  function connect(incoming: Incoming[], targetId: string) {
    for (const item of incoming) {
      flowCount += 1;
      const id = `Flow_${flowCount}`;
      const source = nodes.find((node) => node.id === item.id);
      const target = nodes.find((node) => node.id === targetId);
      if (!source || !target) {
        continue;
      }

      source.outgoing.push(id);
      target.incoming.push(id);
      flows.push({
        id,
        source: source.id,
        target: target.id,
        name: item.label,
        waypoints: waypoints(source, target),
      });
    }
  }

  function placeSequence(sequence: FlowStep[], x: number, centerY: number, incoming: Incoming[]): { right: number; open: Incoming[] } {
    let cursorX = x;
    let right = x;
    let open = incoming;

    sequence.forEach((step, stepIndex) => {
      const followed = stepIndex < sequence.length - 1;

      if (open.length === 0 && step.type !== "start") {
        const previous = nodes[nodes.length - 1];
        if (previous) {
          open = [{ id: previous.id }];
        }
      }

      if (step.type === "goto") {
        if (open.length === 0) {
          open = [];
          const size = TASK;
          const shape = addShape("task", step.target, cursorX, centerY, size.w, size.h, step.lane);
          right = Math.max(right, shape.x + shape.w);
          cursorX = right + GAP_X;
          open = [{ id: shape.id }];
          return;
        }

        for (const item of open) {
          pending.push({ sourceId: item.id, label: item.label, target: step.target, line: step.line });
        }

        if (!followed) {
          open = [];
        }
        return;
      }

      if (step.type === "gateway") {
        const gateway = addShape(step.mode === "parallel" ? "parallelGateway" : "exclusiveGateway", step.name, cursorX, centerY, GATEWAY.w, GATEWAY.h, step.lane);
        connect(open, gateway.id);
        const heights = step.branches.map((branch) => sequenceHeight(branch.steps));
        const stack = heights.reduce((sum, height) => sum + height, 0) + GAP_Y * (heights.length - 1);
        let top = centerY - stack / 2;
        let branchRight = gateway.x + gateway.w;
        const join: Incoming[] = [];

        step.branches.forEach((branch, branchIndex) => {
          const height = heights[branchIndex] ?? EVENT.h;
          const placed = placeSequence(branch.steps, gateway.x + gateway.w + GAP_X, top + height / 2, [{ id: gateway.id, label: branch.label || undefined }]);
          branchRight = Math.max(branchRight, placed.right);
          join.push(...placed.open);
          top += height + GAP_Y;
        });

        right = Math.max(right, branchRight);
        cursorX = right + GAP_X;
        open = join;
        return;
      }

      if (step.type === "end" && followed) {
        const previous = open;
        const shape = addShape("endEvent", step.name, cursorX, centerY, EVENT.w, EVENT.h, step.lane);
        connect(open, shape.id);
        right = Math.max(right, shape.x + shape.w);
        cursorX = right + GAP_X;
        open = previous;
        return;
      }

      const size = step.type === "task" ? TASK : EVENT;
      const tag = step.type === "task" ? step.task : step.type === "start" ? "startEvent" : "endEvent";
      const shape = addShape(tag, step.name, cursorX, centerY, size.w, size.h, step.lane, step.type === "task" ? step.doc : undefined);
      connect(open, shape.id);
      right = Math.max(right, shape.x + shape.w);
      cursorX = right + GAP_X;
      open = step.type === "end" ? [] : [{ id: shape.id }];
    });

    return { right, open };
  }

  const height = sequenceHeight(steps);
  const placed = placeSequence(steps, 180, 120 + height / 2, []);

  if (placed.open.length > 0) {
    const centers = placed.open.map((item) => {
      const node = nodes.find((shape) => shape.id === item.id);
      return node ? node.y + node.h / 2 : 120 + height / 2;
    });
    const center = centers.reduce((sum, value) => sum + value, 0) / centers.length;
    const endLane = nodes.find((shape) => shape.id === placed.open[0]?.id)?.lane ?? null;
    const end = addShape("endEvent", "Fim", placed.right + GAP_X, center, EVENT.w, EVENT.h, endLane);
    connect(placed.open, end.id);
  }

  for (const item of pending) {
    const ids = names.get(normalize(item.target)) ?? [];
    if (ids.length === 0) {
      const source = nodes.find((node) => node.id === item.sourceId);
      const created = addShape("task", item.target, (source?.x ?? 180) + (source?.w ?? 0) + GAP_X, (source ? source.y + source.h / 2 : 160) + TASK.h + GAP_Y, TASK.w, TASK.h, source?.lane ?? null);
      connect([{ id: item.sourceId, label: item.label }], created.id);
      continue;
    }

    connect([{ id: item.sourceId, label: item.label }], ids[0]);
  }

  const lanes = arrangeLanes(nodes);

  for (const flow of flows) {
    const source = nodes.find((node) => node.id === flow.source);
    const target = nodes.find((node) => node.id === flow.target);
    if (source && target) {
      flow.waypoints = waypoints(source, target);
    }
  }

  return { nodes, flows, lanes };
}

function arrangeLanes(nodes: Shape[]): LaneBand[] {
  const order: string[] = [];
  for (const node of nodes) {
    if (node.lane && !order.includes(node.lane)) {
      order.push(node.lane);
    }
  }

  if (order.length === 0) {
    return [];
  }

  const fallback = order[0];
  for (const node of nodes) {
    if (!node.lane && fallback) {
      node.lane = fallback;
    }
  }

  const minX = Math.min(...nodes.map((node) => node.x));
  const maxRight = Math.max(...nodes.map((node) => node.x + node.w));
  const header = 36;
  const laneX = Math.round(minX - header - 20);
  const laneW = Math.round(maxRight - laneX + 48);
  let cursorY = 60;
  const bands: LaneBand[] = [];

  order.forEach((name, index) => {
    const group = nodes.filter((node) => node.lane === name);
    if (group.length === 0) {
      return;
    }

    const minY = Math.min(...group.map((node) => node.y));
    const shift = cursorY + 28 - minY;
    for (const node of group) {
      node.y = Math.round(node.y + shift);
    }

    const bottom = Math.max(...group.map((node) => node.y + node.h)) + 28;
    bands.push({
      id: `Lane_${index + 1}`,
      name,
      x: laneX,
      y: cursorY,
      w: laneW,
      h: Math.round(bottom - cursorY),
      nodes: group.map((node) => node.id),
    });
    cursorY = bottom;
  });

  return bands;
}

function waypoints(source: Shape, target: Shape): Array<{ x: number; y: number }> {
  const sourceRight = source.x + source.w;
  const sourceCy = Math.round(source.y + source.h / 2);
  const targetLeft = target.x;
  const targetCy = Math.round(target.y + target.h / 2);

  if (target.x + 1 >= sourceRight) {
    if (Math.abs(sourceCy - targetCy) < 2) {
      return [
        { x: sourceRight, y: sourceCy },
        { x: targetLeft, y: targetCy },
      ];
    }

    const mid = Math.round((sourceRight + targetLeft) / 2);
    return [
      { x: sourceRight, y: sourceCy },
      { x: mid, y: sourceCy },
      { x: mid, y: targetCy },
      { x: targetLeft, y: targetCy },
    ];
  }

  const low = Math.max(source.y + source.h, target.y + target.h) + 40;
  const sourceCx = Math.round(source.x + source.w / 2);
  const targetCx = Math.round(target.x + target.w / 2);
  return [
    { x: sourceCx, y: source.y + source.h },
    { x: sourceCx, y: low },
    { x: targetCx, y: low },
    { x: targetCx, y: target.y + target.h },
  ];
}

function render(diagram: { nodes: Shape[]; flows: Flow[]; lanes: LaneBand[] }): string {
  const laneSet = diagram.lanes.length
    ? `<bpmn:laneSet id="LaneSet_1">${diagram.lanes
        .map(
          (lane) =>
            `<bpmn:lane id="${lane.id}" name="${escapeXml(lane.name)}">${lane.nodes.map((id) => `<bpmn:flowNodeRef>${id}</bpmn:flowNodeRef>`).join("")}</bpmn:lane>`,
        )
        .join("")}</bpmn:laneSet>`
    : "";
  const elements = diagram.nodes.map((node) => {
    const incoming = node.incoming.map((id) => `<bpmn:incoming>${id}</bpmn:incoming>`).join("");
    const outgoing = node.outgoing.map((id) => `<bpmn:outgoing>${id}</bpmn:outgoing>`).join("");
    const documentation = node.doc ? `<bpmn:documentation>${escapeXml(node.doc)}</bpmn:documentation>` : "";
    return `<bpmn:${node.tag} id="${node.id}" name="${escapeXml(node.name)}">${documentation}${incoming}${outgoing}</bpmn:${node.tag}>`;
  });
  const flows = diagram.flows.map((flow) => {
    const name = flow.name ? ` name="${escapeXml(flow.name)}"` : "";
    return `<bpmn:sequenceFlow id="${flow.id}"${name} sourceRef="${flow.source}" targetRef="${flow.target}" />`;
  });
  const laneShapes = diagram.lanes.map(
    (lane) =>
      `<bpmndi:BPMNShape id="${lane.id}_di" bpmnElement="${lane.id}" isHorizontal="true"><dc:Bounds x="${lane.x}" y="${lane.y}" width="${lane.w}" height="${lane.h}" /></bpmndi:BPMNShape>`,
  );
  const shapes = diagram.nodes.map(
    (node) =>
      `<bpmndi:BPMNShape id="${node.id}_di" bpmnElement="${node.id}"><dc:Bounds x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" /></bpmndi:BPMNShape>`,
  );
  const edges = diagram.flows.map((flow) => {
    const points = flow.waypoints.map((point) => `<di:waypoint x="${point.x}" y="${point.y}" />`).join("");
    return `<bpmndi:BPMNEdge id="${flow.id}_di" bpmnElement="${flow.id}">${points}</bpmndi:BPMNEdge>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    ${laneSet}
    ${elements.join("")}
    ${flows.join("")}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      ${laneShapes.join("")}
      ${shapes.join("")}
      ${edges.join("")}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

function peelDoc(text: string): { text: string; doc: string } {
  const [main, ...notes] = text.split(/\s+\|\|\s+/);
  return { text: (main ?? text).trim(), doc: notes.join(" || ").trim() };
}

function organizeCatalog(source: string): string | null {
  if (source.split(/\r?\n/).some((line) => /^\s*(?:raia|lane)\s+\S/i.test(line) || /^\s*\?\s+\S/.test(line) || /^\s*(?:sim|não|nao)\s*:/i.test(line))) {
    return null;
  }

  const rawLines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const activityRe = /^([A-Za-z]{0,4})(\d{1,3})[.)]\s+(.+)$/;
  const gatewayRe = /^(?:gateway|decis[aã]o|desvio|exclusiv[oa])\s*:\s*(.*)$/i;
  const blocks: CatalogBlock[] = [];
  let lane: string | null = null;
  let lastTask: CatalogTask | null = null;
  let pendingGateway = false;
  let taskCount = 0;

  rawLines.forEach((text, sourceIndex) => {
    const gateway = text.match(gatewayRe);
    if (gateway) {
      const name = cleanQuestion(gateway[1] ?? "");
      if (name) {
        blocks.push({ kind: "gateway", name, lane, sourceIndex });
        lastTask = null;
        pendingGateway = false;
      } else {
        pendingGateway = true;
      }
      return;
    }

    if (pendingGateway || (text.endsWith("?") && !activityRe.test(text) && text.length <= 180)) {
      blocks.push({ kind: "gateway", name: cleanQuestion(text), lane, sourceIndex });
      lastTask = null;
      pendingGateway = false;
      return;
    }

    const activity = text.match(activityRe);
    if (activity?.[2] && activity[3]) {
      const task: CatalogTask = {
        order: Number(activity[2]),
        code: `${activity[1] ?? ""}${activity[2]}`,
        title: activity[3].trim(),
        doc: "",
        lane,
        sourceIndex,
      };
      blocks.push({ kind: "task", task });
      lastTask = task;
      taskCount += 1;
      return;
    }

    if (isLaneHeader(text)) {
      lane = presentLane(text);
      lastTask = null;
      return;
    }

    if (lastTask) {
      lastTask.doc = lastTask.doc ? `${lastTask.doc} ${text}` : text;
    }
  });

  if (taskCount < 2) {
    return null;
  }

  const tasks = blocks.flatMap((block) => (block.kind === "task" ? [block.task] : []));
  const gateway = blocks.find((block) => block.kind === "gateway");
  let trunk = [...tasks].sort(byCatalogOrder);
  let negative: CatalogTask[] = [];
  let positive: CatalogTask[] = [];

  if (gateway?.kind === "gateway") {
    const before = tasks.filter((task) => task.sourceIndex < gateway.sourceIndex);
    const cutoff = before.reduce((max, task) => Math.max(max, task.order), 0);
    const rest = tasks.filter((task) => task.order > cutoff).sort(byCatalogOrder);
    trunk = tasks.filter((task) => task.order <= cutoff).sort(byCatalogOrder);
    negative = rest.filter((task) => isNegativeTask(task));
    positive = rest.filter((task) => !isNegativeTask(task));
    if (negative.length === 0 || positive.length === 0) {
      trunk = [...trunk, ...rest].sort(byCatalogOrder);
      negative = [];
      positive = [];
    }
  }

  const lines: string[] = [];
  let current: string | null = null;

  const writeTask = (task: CatalogTask, indent: string, label?: string) => {
    if (task.lane && task.lane !== current && indent === "") {
      lines.push(`raia ${task.lane}`);
      current = task.lane;
    }

    const lanePrefix = task.lane && task.lane !== current ? `[${task.lane}] ` : "";
    if (task.lane) {
      current = task.lane;
    }

    const head = label ? `${label}: ` : "";
    const doc = task.doc ? ` || ${clipDoc(task.doc)}` : "";
    lines.push(`${indent}${head}${lanePrefix}${task.code}. ${task.title}${doc}`);
  };

  trunk.forEach((task) => writeTask(task, ""));

  if (gateway?.kind === "gateway" && negative.length > 0 && positive.length > 0) {
    if (gateway.lane && gateway.lane !== current) {
      lines.push(`raia ${gateway.lane}`);
      current = gateway.lane;
    }

    lines.push(`? ${gateway.name}`);
    negative.forEach((task, index) => writeTask(task, index === 0 ? "  " : "    ", index === 0 ? "não" : undefined));
    positive.forEach((task, index) => writeTask(task, index === 0 ? "  " : "    ", index === 0 ? "sim" : undefined));
  }

  return lines.join("\n");
}

function byCatalogOrder(left: CatalogTask, right: CatalogTask): number {
  return left.order - right.order || left.sourceIndex - right.sourceIndex;
}

function isNegativeTask(task: CatalogTask): boolean {
  const text = normalize(`${task.title} ${task.doc}`);
  return /indisponib|n[aã]o houver|dispensa|indefer|rejeit|invi[aá]v|impossib|n[aã]o h[aá]/.test(text);
}

function isLaneHeader(text: string): boolean {
  if (text.length < 2 || text.length > 80 || /[.?!]$/.test(text) || /^\d/.test(text)) {
    return false;
  }

  const letters = text.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length < 2) {
    return false;
  }

  return letters === letters.toLocaleUpperCase("pt-BR") && letters !== letters.toLocaleLowerCase("pt-BR");
}

function presentLane(value: string): string {
  return value
    .split(/(\s+|[\\/])/)
    .map((part) => {
      if (!part.trim() || part === "/" || part === "\\") {
        return part;
      }

      const letters = part.replace(/[^A-Za-zÀ-ÿ]/g, "");
      if (letters.length > 0 && letters.length <= 4 && part === part.toLocaleUpperCase("pt-BR")) {
        return part;
      }

      return part.charAt(0).toLocaleUpperCase("pt-BR") + part.slice(1).toLocaleLowerCase("pt-BR");
    })
    .join("");
}

function cleanQuestion(value: string): string {
  return value.trim().replace(/\?+$/, "").trim();
}

function clipDoc(value: string): string {
  const clean = value.trim().replace(/\s+/g, " ");
  return clean.length > 500 ? `${clean.slice(0, 500).trim()}…` : clean;
}

interface CatalogTask {
  order: number;
  code: string;
  title: string;
  doc: string;
  lane: string | null;
  sourceIndex: number;
}

type CatalogBlock = { kind: "task"; task: CatalogTask } | { kind: "gateway"; name: string; lane: string | null; sourceIndex: number };

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
