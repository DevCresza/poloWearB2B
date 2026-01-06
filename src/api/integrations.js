// Integrations - Usa Supabase quando configurado, senão usa mock
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { Core as MockCore } from './mockIntegrations';
import { supabaseIntegrations } from './supabaseIntegrations';

// Funções que usam Supabase Storage quando disponível
export const UploadFile = async (params) => {
  if (isSupabaseConfigured()) {
    return supabaseIntegrations.UploadFile(params);
  }
  return MockCore.UploadFile(params);
};

export const UploadPrivateFile = async (params) => {
  if (isSupabaseConfigured()) {
    return supabaseIntegrations.UploadPrivateFile(params);
  }
  return MockCore.UploadPrivateFile(params);
};

export const CreateFileSignedUrl = async (params) => {
  if (isSupabaseConfigured()) {
    return supabaseIntegrations.CreateFileSignedUrl(params);
  }
  return MockCore.CreateFileSignedUrl(params);
};

// Envio de email via Edge Function do Supabase (Resend)
export const SendEmail = async (params) => {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.functions.invoke('sendEmail', {
        body: params
      });

      if (error) {
        console.error('Erro ao enviar email via Edge Function:', error);
        // Fallback para mock em caso de erro
        return MockCore.SendEmail(params);
      }

      return data;
    } catch (err) {
      console.error('Erro ao chamar Edge Function sendEmail:', err);
      // Fallback para mock em caso de erro
      return MockCore.SendEmail(params);
    }
  }
  return MockCore.SendEmail(params);
};

// Funções que ainda usam mock (não dependem de storage)
export const InvokeLLM = (params) => MockCore.InvokeLLM(params);
export const GenerateImage = (params) => MockCore.GenerateImage(params);
export const ExtractDataFromUploadedFile = (params) => MockCore.ExtractDataFromUploadedFile(params);

// Core export para compatibilidade
export const Core = {
  InvokeLLM,
  SendEmail,
  UploadFile,
  GenerateImage,
  ExtractDataFromUploadedFile,
  CreateFileSignedUrl,
  UploadPrivateFile,
};
