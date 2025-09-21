export interface Participant {
  nom: string;
  prenom: string;
  role: 'speaker' | 'mc' | 'organisateur' | string;
}

export interface PrinterInfo {
  name: string;
  model: string;
  isConnected: boolean;
}

export interface PrinterStatus {
  connected: boolean;
  ready: boolean;
  error: string | null;
}
