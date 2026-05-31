import axios from "axios";
import { auth } from "../config/firebase";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const getAuthHeaders = async () => {
  if (!auth.currentUser) return {};
  const token = await auth.currentUser.getIdToken();
  return { Authorization: `Bearer ${token}` };
};

export const submitFeedback = async (feedbackData) => {
  const headers = await getAuthHeaders();
  
  if (auth.currentUser) {
    feedbackData.user_id = auth.currentUser.uid;
    if (!feedbackData.email) {
      feedbackData.email = auth.currentUser.email;
    }
  }

  const response = await axios.post(`${API_URL}/api/feedback`, feedbackData, { headers });
  return response.data;
};
