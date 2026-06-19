// Data model for the experiment-design wizard; fields map directly to the template sections.

export interface DV {
  name: string;
  scale: string;
  measurement: string;
}

export interface IV {
  name: string;
  nLevels: string;
  levels: string;
  description: string;
}

export interface CV {
  name: string;
  nLevels: string;
  level: string;
  rationale: string;
}

export interface RV {
  name: string;
  nLevels: string;
  levels: string;
  rationale: string;
}

export interface ProcedureStep {
  text: string;
  duration: string;
}

export type DesignType = "within" | "between" | "mixed" | "";
export type Counterbalancing = "full" | "latin" | "none" | "";

export interface ExperimentDesign {
  title: string;
  researchQuestions: string[];

  dvs: DV[];
  ivs: IV[];
  cvs: CV[];
  rvs: RV[];

  designType: DesignType;
  designMixedSpec: string;
  counterbalancing: Counterbalancing;
  counterbalancingNotes: string;

  participants: {
    targetN: string;
    perGroupN: string;
    recruitment: string;
    inclusionExclusion: string;
    consent: string;
    compensation: string;
  };

  apparatus: {
    hardware: string;
    software: string;
    stimulus: string;
    questionnaires: string;
    testMaterials: string;
  };

  procedure: {
    steps: ProcedureStep[];
    totalDuration: string;
  };

  trialConfig: string;
  agent: string;
}

export const emptyDesign: ExperimentDesign = {
  title: "",
  researchQuestions: ["", "", ""],
  dvs: [{ name: "", scale: "", measurement: "" }],
  ivs: [{ name: "", nLevels: "", levels: "", description: "" }],
  cvs: [{ name: "", nLevels: "", level: "", rationale: "" }],
  rvs: [{ name: "", nLevels: "", levels: "", rationale: "" }],
  designType: "",
  designMixedSpec: "",
  counterbalancing: "",
  counterbalancingNotes: "",
  participants: {
    targetN: "",
    perGroupN: "",
    recruitment: "",
    inclusionExclusion: "",
    consent: "",
    compensation: "",
  },
  apparatus: {
    hardware: "",
    software: "",
    stimulus: "",
    questionnaires: "",
    testMaterials: "",
  },
  procedure: {
    steps: [{ text: "", duration: "" }],
    totalDuration: "",
  },
  trialConfig: "",
  agent: "",
};
