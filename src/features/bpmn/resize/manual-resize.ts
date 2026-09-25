import LiveResizeBehavior from "@/features/bpmn/resize/LiveResizeBehavior";
import ManualResizeRules from "@/features/bpmn/resize/ManualResizeRules";

const manualResizeModule = {
  __init__: ["manualResizeRules", "liveResizeBehavior"],
  manualResizeRules: ["type", ManualResizeRules],
  liveResizeBehavior: ["type", LiveResizeBehavior],
};

export default manualResizeModule;
