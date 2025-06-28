# 🤖 AI Chat App - Standalone

A beautiful, production-ready AI chat application with multi-provider support and RAG document integration.

## ✨ Features

- **Multi-AI Provider Support**: OpenAI, Anthropic, and OpenRouter
- **RAG Document System**: Upload and query knowledge base documents
- **Conversation Management**: Create, manage, and delete chat conversations
- **API Key Management**: Secure per-user API key storage
- **Real-time Messaging**: Smooth chat experience with typing indicators
- **Admin Panel**: Document management for admins
- **Responsive Design**: Beautiful UI with dark theme
- **Cost Tracking**: Token counting and cost estimation
- **Security**: Row Level Security (RLS) with Supabase

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, RLS)
- **AI APIs**: OpenAI, Anthropic, OpenRouter
- **Icons**: Lucide React
- **Notifications**: React Toastify
- **Build Tool**: Vite

## 🚀 Quick Start

### 1. Clone and Install

```bash
cd standalone-chat-app
npm install
```

### 2. Setup Environment Variables

Create a `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Setup Database

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Run the database setup script from `database/setup.sql`

### 4. Start Development

```bash
npm run dev
```

## 📁 Project Structure

```
standalone-chat-app/
├── src/
│   ├── components/          # Reusable UI components
│   ├── pages/              # Main page components (Chat, Settings)
│   ├── hooks/              # Custom React hooks
│   ├── contexts/           # React contexts (Auth, etc.)
│   ├── services/           # AI service and API integrations
│   └── styles/             # CSS and styling files
├── database/               # SQL scripts for database setup
├── config/                 # Configuration files
└── public/                 # Static assets
```

## 🔧 Configuration

### AI Provider Setup

1. **OpenAI**: Get API key from [OpenAI Platform](https://platform.openai.com)
2. **Anthropic**: Get API key from [Anthropic Console](https://console.anthropic.com)
3. **OpenRouter**: Get API key from [OpenRouter](https://openrouter.ai)

Add your API keys through the Settings page in the app.

### Supabase Setup

1. Create a new Supabase project
2. Run the database setup script
3. Configure authentication settings
4. Set up Row Level Security policies

## 🔒 Security Features

- **Row Level Security**: Users can only access their own data
- **Encrypted API Keys**: User API keys are stored securely
- **Admin Controls**: Admin-only document management
- **Authentication**: Supabase Auth with email/password

## 🎨 Customization

The app uses Tailwind CSS for styling. You can customize:

- Colors and themes in `config/tailwind.config.js`
- Component styles in individual components
- Global styles in `src/styles/index.css`

## 📊 Database Schema

The app uses 4 main tables:

- `ai_api_keys`: User API key storage
- `rag_documents`: Knowledge base documents
- `chat_conversations`: Chat conversation metadata
- `chat_messages`: Individual chat messages

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section below
2. Open an issue on GitHub
3. Review the Supabase documentation

## 🔧 Troubleshooting

### Common Issues

**403 Forbidden Error**: 
- Ensure database setup script has been run
- Check RLS policies are properly configured
- Verify user authentication

**API Key Not Working**:
- Check API key is valid and has sufficient credits
- Verify the provider is correctly selected
- Check network connectivity

**Chat Not Loading**:
- Verify Supabase environment variables
- Check browser console for errors
- Ensure database tables exist

### Development Tips

- Use browser DevTools to debug issues
- Check Supabase logs for database errors
- Monitor network requests for API call issues
- Enable debug logging in development mode 