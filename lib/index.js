/**
 * dsh-hvac — 风管选型与冷负荷估算
 */

export const name = "dsh-hvac";
export const inject = ["tools"];

const NL = String.fromCharCode(10);
const SITE = "https://deepseekbase.com/zh/tools/";
const TEXT_OUTPUT = {
  schema: { type: "object", additionalProperties: false, properties: { text: { type: "string" } }, required: ["text"] },
  render: (_args, value) => [{ type: "text", text: (value && value.text) || "" }],
};

function n(v, d) { const x = Number(v); return Number.isFinite(x) ? x : d; }
function f(x) { return (Math.round(x * 10) / 10).toString(); }

const TOOLS = {
  hvac_duct: {
    description: "风管选型：按风量（m³/h）与风速（m/s）算圆管直径与方管尺寸",
    parameters: {
      type: "object", additionalProperties: false,
      properties: {
        airflow_m3h: { type: "number", description: "风量 m³/h" },
        velocity_ms: { type: "number", description: "风速 m/s，主风管常用 5–8" },
        rectangular: { type: "boolean", description: "是否输出方管（可选）" },
      },
      required: ["airflow_m3h"],
    },
    run(args) {
      const Q = n(args.airflow_m3h, 0);
      const v = n(args.velocity_ms, 6);
      if (Q <= 0 || v <= 0) throw new Error("风量与风速必须大于 0");
      const a = Q / 3600 / v;
      const d = Math.sqrt(4 * a / Math.PI) * 1000;
      const lines = ["风管选型", "=".repeat(52), "风量: " + Q + " m³/h", "风速: " + v + " m/s", "截面积: " + f(a * 10000) + " cm²"];
      lines.push("圆管直径: " + Math.round(d) + " mm（取标准 100/125/160/200/250/315/400…）");
      const side = Math.sqrt(a);
      lines.push("方管（正方形近似）: " + Math.round(side * 1000) + " × " + Math.round(side * 1000) + " mm");
      lines.push("方管（1:2）: " + Math.round(Math.sqrt(a / 2) * 1000) + " × " + Math.round(Math.sqrt(a * 2) * 1000) + " mm");
      lines.push("");
      lines.push("风速建议: 主风管 5–8 m/s，支管 3–5 m/s，回风 4–6 m/s；噪声要求高时取低值。");
      lines.push("");
      lines.push("更多工具：" + SITE);
      return lines.join(NL);
    },
  },
  hvac_cooling_load: {
    description: "冷负荷估算：按面积、层高、朝向、保温与人员设备粗略估算 W 与匹数",
    parameters: {
      type: "object", additionalProperties: false,
      properties: {
        area_m2: { type: "number", description: "面积 m²" },
        height_m: { type: "number", description: "层高 m，默认 3" },
        insulation: { type: "string", enum: ["good", "average", "poor"], description: "保温/遮阳" },
        people: { type: "number", description: "人数，可选" },
        equipment_w: { type: "number", description: "设备功率 W，可选" },
      },
      required: ["area_m2"],
    },
    run(args) {
      const area = n(args.area_m2, 0);
      if (area <= 0) throw new Error("面积必须大于 0");
      const h = n(args.height_m, 3);
      const ins = String(args.insulation || "average");
      const base = { good: 100, average: 130, poor: 170 }[ins] || 130;
      const volumeFactor = Math.max(1, h / 3);
      let w = area * base * volumeFactor;
      const people = n(args.people, 0);
      const equip = n(args.equipment_w, 0);
      w += people * 100;
      w += equip * 0.8;
      const btu = w * 3.412;
      const hp = w / 2500; // 1 匹 ≈ 2500W 制冷量
      return ["冷负荷估算", "=".repeat(52), "面积: " + area + " m²", "层高: " + h + " m", "保温: " + ins,
        "人员: " + people + " 人", "设备: " + equip + " W", "", "冷负荷: " + Math.round(w) + " W",
        "≈ " + Math.round(btu) + " BTU/h", "≈ " + f(hp) + " 匹（按 2500W/匹）", "",
        "粗估结果用于选型方向，正式设计需逐项负荷计算（朝向、窗墙比、新风、人员密度等）。", "",
        "更多工具：" + SITE].join(NL);
    },
  },
};

export function apply(ctx, config) {
  void config;
  for (const name of Object.keys(TOOLS)) {
    const t = TOOLS[name];
    ctx.tools.register({
      name: name,
      description: t.description,
      parameters: t.parameters,
      output: TEXT_OUTPUT,
      async execute(args) { try { return { text: t.run(args || {}) }; } catch (e) { return { text: "处理失败: " + String((e && e.message) || e) }; } },
    });
  }
}
