import api from './api';

export interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
  ts: number;
}

export interface ChatResponse {
  answer: string;
  mode: 'self' | 'analyst';
}

export const chatbotService = {
  async send(question: string, applicantId?: string): Promise<ChatResponse> {
    const payload: { question: string; applicant_id?: string } = { question };
    if (applicantId) payload.applicant_id = applicantId;
    const res = await api.post('/chatbot', payload);
    return res.data;
  },
};
