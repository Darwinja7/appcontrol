export interface RegistroInput {
  fechaHora: string;
  usuario: string;
  proyecto: string;
  torre: string;
  nivel: string;
  zona: string;
  actividad: string;
  avance: number;
  observacion: string;
  fuente: string;
  estado: string;
  idempotencyKey: string;
  hash: string;
}

export interface StorageHealth {
  connected: boolean;
  readable: boolean;
  writable: boolean;
  message?: string;
}

export interface StorageAdapter {
  name: string;
  healthCheck(): Promise<StorageHealth>;
  findRegistroByIdempotencyKey(key: string): Promise<string | null>;
  appendRegistro(registro: RegistroInput): Promise<string>;
}
