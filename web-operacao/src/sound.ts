import type { SolicitacaoOut } from "./types";

export function temUrgentePendente(solicitacoes: SolicitacaoOut[]): boolean {
  return solicitacoes.some((s) => s.status === "pendente" && s.urgente);
}

let audioContext: AudioContext | null = null;

export function desbloquearAudio(): void {
  if (audioContext === null) {
    audioContext = new AudioContext();
  }
}

function bipe(frequenciaHz: number, duracaoMs: number): void {
  if (audioContext === null) return;
  const oscilador = audioContext.createOscillator();
  const ganho = audioContext.createGain();
  oscilador.frequency.value = frequenciaHz;
  oscilador.connect(ganho);
  ganho.connect(audioContext.destination);
  oscilador.start();
  oscilador.stop(audioContext.currentTime + duracaoMs / 1000);
}

export function tocarBipeNovo(): void {
  bipe(880, 150);
}

export function tocarBipeUrgente(): void {
  bipe(440, 300);
}
