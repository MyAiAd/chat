# 🚀 AI Chat App - Deployment Guide

This guide will help you deploy the AI Chat App to various platforms.

## 📋 Pre-Deployment Checklist

- [ ] Supabase project created and configured
- [ ] Database setup script executed
- [ ] Environment variables configured
- [ ] App tested locally
- [ ] Build process verified

## 🛠️ Environment Setup

### 1. Supabase Setup

1. **Create a Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Note your project URL and anon key

2. **Setup Database**
   - Go to SQL Editor in your Supabase dashboard
   - Run the script from `database/setup.sql`
   - Verify all tables and policies are created

3. **Configure Authentication**
   - Enable email/password authentication
   - Set up your redirect URLs
   - Configure email templates if needed

### 2. Environment Variables

Create a `.env` file (copy from `env.example`):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

## 🌐 Platform-Specific Deployment

### Vercel (Recommended)

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   cd standalone-chat-app
   vercel
   ```

3. **Configure Environment Variables**
   - Go to your Vercel dashboard
   - Add environment variables in Settings
   - Redeploy if needed

4. **Domain Configuration**
   - Update Supabase auth redirect URLs
   - Add your domain to allowed origins

### Netlify

1. **Build Command**: `npm run build`
2. **Publish Directory**: `dist`
3. **Environment Variables**: Add in Netlify dashboard
4. **Redirects**: Create `_redirects` file:
   ```
   /*    /index.html   200
   ```

### Railway

1. **Connect GitHub repository**
2. **Set build command**: `npm run build`
3. **Add environment variables**
4. **Deploy automatically on push**

### AWS Amplify

1. **Connect GitHub repository**
2. **Build settings**:
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm ci
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: dist
       files:
         - '**/*'
   ```

### Self-Hosted (Docker)

1. **Create Dockerfile**:
   ```dockerfile
   FROM node:18-alpine

   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production

   COPY . .
   RUN npm run build

   FROM nginx:alpine
   COPY --from=0 /app/dist /usr/share/nginx/html
   COPY nginx.conf /etc/nginx/conf.d/default.conf

   EXPOSE 80
   CMD ["nginx", "-g", "daemon off;"]
   ```

2. **Create nginx.conf**:
   ```nginx
   server {
       listen 80;
       server_name localhost;
       root /usr/share/nginx/html;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```

3. **Build and run**:
   ```bash
   docker build -t ai-chat-app .
   docker run -p 80:80 ai-chat-app
   ```

## 🔒 Security Configuration

### Supabase Security

1. **Row Level Security (RLS)**
   - Verify all tables have RLS enabled
   - Test policies with different user types

2. **API Keys**
   - Ensure anon key is public-safe
   - Keep service role key secure

3. **Domain Restrictions**
   - Add your domain to allowed origins
   - Configure CORS settings

### Environment Variables

1. **Never commit sensitive data**
2. **Use platform environment variable systems**
3. **Rotate keys regularly**

## 📊 Performance Optimization

### Build Optimization

1. **Bundle Analysis**
   ```bash
   npm run build
   npx vite preview --port 3000
   ```

2. **Code Splitting**
   - Already implemented with React.lazy()
   - Monitor bundle sizes

3. **Asset Optimization**
   - Images are optimized
   - Fonts are loaded efficiently

### Database Optimization

1. **Indexes**
   - All necessary indexes are created
   - Monitor query performance

2. **Connection Pooling**
   - Supabase handles this automatically
   - Monitor connection usage

## 🔧 Monitoring & Maintenance

### Health Checks

1. **Frontend Health**
   - Monitor app loading times
   - Check for JavaScript errors

2. **Database Health**
   - Monitor Supabase dashboard
   - Check query performance

3. **API Health**
   - Monitor AI provider API usage
   - Track rate limits and costs

### Updates & Maintenance

1. **Security Updates**
   - Keep dependencies updated
   - Monitor security advisories

2. **Feature Updates**
   - Test thoroughly before deployment
   - Use staging environment

3. **Database Migrations**
   - Backup before schema changes
   - Test migrations on staging

## 🚨 Troubleshooting

### Common Issues

**Build Failures**
- Check Node.js version (use 18+)
- Clear npm cache: `npm ci`
- Check environment variables

**Authentication Issues**
- Verify Supabase configuration
- Check redirect URLs
- Verify RLS policies

**Database Connection Issues**
- Check Supabase project status
- Verify environment variables
- Check network connectivity

**API Integration Issues**
- Verify AI provider API keys
- Check rate limits
- Monitor API responses

### Debug Mode

Enable debug logging:
```bash
NODE_ENV=development npm run dev
```

### Support

For deployment issues:
1. Check the troubleshooting section in README.md
2. Review Supabase documentation
3. Check platform-specific documentation
4. Monitor application logs

## 📱 Mobile Considerations

The app is responsive and works on mobile devices:

1. **PWA Support** (optional enhancement)
2. **Touch-friendly interface**
3. **Mobile-optimized layouts**
4. **Fast loading on mobile networks**

## 🔄 CI/CD Pipeline

Example GitHub Actions workflow:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - name: Deploy to Vercel
        uses: vercel/action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

Happy deploying! 🎉 