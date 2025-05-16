export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  role: string;
  avatar: string | null;
  is_onboarded: boolean;
  is_dev_mode: boolean;
  default_markdown_converter: string;
  default_summarization_model: string;
  default_chat_model: string;
}
