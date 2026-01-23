export interface Message {
  role: 'user' | 'assistant';
  content: string;
  images: ImageRef[];
}

export interface ImageRef {
  url: string;
  localPath: string;
  filename: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
}

export interface ProjectInfo {
  name: string;
  conversations: ConversationLink[];
}

export interface ConversationLink {
  id: string;
  title: string;
  url: string;
}
