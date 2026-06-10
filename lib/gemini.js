import { GoogleGenAI, Type } from "@google/genai";

// Model Gemini dùng để gợi ý. Đổi tại đây nếu muốn:
//   "gemini-2.5-flash"       -> free, ổn định (khuyến nghị)
//   "gemini-2.5-flash-lite"  -> nhanh/rẻ hơn
//   "gemini-3.5-flash"       -> mạnh hơn
const MODEL = "gemini-2.5-flash";

// Cắt tài liệu để giữ trong giới hạn token của bậc miễn phí.
const MAX_DOC_CHARS = 50000;
const MAX_TASK_CHARS = 8000;

// Đã cấu hình API key Gemini chưa?
export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

// Gọi Gemini gợi ý độ ưu tiên + giải pháp + câu hỏi cho 1 task,
// dựa trên tài liệu tham khảo của dự án. Trả về object JSON đã parse.
export async function suggestTask({
  referenceDocs = "",
  title = "",
  customerTask = "",
}) {
  if (!isGeminiConfigured()) {
    throw new Error("Chưa cấu hình GEMINI_API_KEY.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const docs = String(referenceDocs || "").slice(0, MAX_DOC_CHARS);
  const taskBody = String(customerTask || "").slice(0, MAX_TASK_CHARS);

  const prompt = `Bạn là một trợ lý phân tích nghiệp vụ (BA) cho phần mềm quản lý task khách hàng.
Dựa vào TÀI LIỆU THAM KHẢO của dự án (nếu có) và NỘI DUNG TASK, hãy:
1) Chấm ĐỘ ƯU TIÊN của task: 1 = Cao, 2 = Trung bình, 3 = Thấp (dựa trên mức độ ảnh hưởng và độ khẩn cấp), kèm LÝ DO ngắn gọn (1-2 câu).
2) Đề xuất GIẢI PHÁP khả thi, bám sát tài liệu dự án, viết ngắn gọn theo gạch đầu dòng.
3) Gợi ý các CÂU HỎI cần làm rõ với khách hàng (nếu thông tin chưa đủ).
Trả lời HOÀN TOÀN bằng tiếng Việt.

=== TÀI LIỆU THAM KHẢO DỰ ÁN ===
${docs || "(không có tài liệu)"}

=== NỘI DUNG TASK ===
Tiêu đề: ${String(title || "(trống)")}
Mô tả / yêu cầu khách hàng: ${taskBody || "(trống)"}`;

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          priority: {
            type: Type.INTEGER,
            description: "Độ ưu tiên: 1=Cao, 2=Trung bình, 3=Thấp",
          },
          priorityReason: {
            type: Type.STRING,
            description: "Lý do ngắn cho mức ưu tiên",
          },
          solution: {
            type: Type.STRING,
            description: "Giải pháp đề xuất (gạch đầu dòng)",
          },
          questions: {
            type: Type.STRING,
            description: "Câu hỏi cần làm rõ với khách (có thể để trống)",
          },
        },
        required: ["priority", "priorityReason", "solution"],
        propertyOrdering: ["priority", "priorityReason", "solution", "questions"],
      },
    },
  });

  const text = res.text;
  if (!text) {
    throw new Error("Gemini không trả về nội dung.");
  }
  return JSON.parse(text);
}
