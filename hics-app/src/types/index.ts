export interface HicsRole {
  id: string;
  title: string;
  abbreviation: string;
  color: string;
  description: string;
  responsibilities: string[];
  reportsTo: string | null;
  category: 'command' | 'operations' | 'logistics' | 'planning' | 'finance';
}

export interface Scenario {
  id: string;
  title: string;
  type: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: string;
  description: string;
  objectives: string[];
  steps: ScenarioStep[];
}

export interface ScenarioStep {
  id: string;
  title: string;
  situation: string;
  question: string;
  options: ScenarioOption[];
  hint?: string;
}

export interface ScenarioOption {
  id: string;
  text: string;
  isCorrect: boolean;
  feedback: string;
  nextStep?: string;
}

export interface QuizQuestion {
  id: string;
  category: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}
