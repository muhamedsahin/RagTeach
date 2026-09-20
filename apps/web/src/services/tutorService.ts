import { tutorActions, getTutorSnapshot } from "@/lib/store";
import { audioService } from "./audioService";
import { ragService } from "./ragService";
import { llmService } from "./llmService";

class TutorService {
  private generation = 0;
  async startLecture(topic?: string) {
    const book = getTutorSnapshot().books.find(b => b.id === getTutorSnapshot().activeBookId);
    await this.askQuestion(`${topic || book?.topics[0] || "Belgenin ana konusu"} konusunu kaynaklara dayanarak, örneklerle adım adım anlat.`, true);
  }
  async askQuestion(question: string, overview = false) {
    if (!question.trim()) return;
    this.interrupt();
    const generation = this.generation;
    tutorActions.addUserMessage(question.trim());
    tutorActions.setActiveCitation(null);
    try {
      const snapshot = getTutorSnapshot();
      if (!snapshot.activeBookId) throw new Error("Başlamak için önce bir PDF yükleyin veya kütüphanenizden bir belge seçin.");
      tutorActions.setTutorState("retrieving");
      const sources = await ragService.retrieve({ query: question, courseId: snapshot.activeBookId, overview });
      if (generation !== this.generation) return;
      if (!sources.length) throw new Error("Bu soruyla ilgili bir kaynak bulamadım. Soruyu belgedeki kavramlarla daha açık ifade etmeyi deneyin.");
      tutorActions.setActiveCitation(sources[0]);
      tutorActions.setTutorState("thinking");
      const context = sources.map((s, i) => `[Kaynak ${i + 1}, Sayfa ${s.pageNumber}, ${s.chapterTitle}]\n${s.excerpt}`).join("\n\n");
      const result = await llmService.generate({ prompt: question, context, courseId: snapshot.activeBookId });
      if (generation !== this.generation) return;
      if (result.error) throw new Error(result.error);
      if (!result.text.trim()) throw new Error("Model boş yanıt verdi. Ayarlardan model bağlantısını kontrol edin.");
      this.speakText(result.text, sources[0].id);
    } catch (error) {
      if (generation !== this.generation) return;
      tutorActions.setStreamingText(error instanceof Error ? error.message : "İstek tamamlanamadı. Tekrar deneyin.");
      tutorActions.commitStreamingToTranscript("ai");
      tutorActions.setTutorState("idle");
    }
  }
  speakText(text: string, citationId?: string, nodeId?: string) {
    if (nodeId) tutorActions.setActiveNode(nodeId);
    tutorActions.setStreamingText(text);
    tutorActions.commitStreamingToTranscript("ai", citationId);
    tutorActions.setTutorState("idle");
    const vCfg = audioService.getVoiceConfig();
    const shouldSpeak = getTutorSnapshot().interactionMode !== "text" || vCfg.autoSpeak === true;
    if (shouldSpeak) {
      const generation = this.generation;
      tutorActions.setTutorState("speaking");
      audioService.simulateVoiceSpeech(text, undefined, () => {
        if (generation === this.generation) tutorActions.setTutorState("idle");
      });
    }
  }
  interrupt() {
    this.generation++;
    llmService.interrupt();
    audioService.stopSpeaking();
    tutorActions.setTutorState("idle");
  }
  pause() { this.interrupt(); tutorActions.setTutorState("paused"); }
  resume() { tutorActions.setTutorState("idle"); }
}
export const tutorService = new TutorService();

