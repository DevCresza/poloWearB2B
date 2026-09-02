// Integrations - Usa Supabase quando configurado, senão usa mock
import { isSupabaseConfigured, supabase, parseInvokeError } from '@/lib/supabase';
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
// Envia e-mail de verdade quando o Supabase esta configurado.
//
// NAO cai no mock quando a Edge Function falha. O fallback anterior devolvia
// { success: true, status: 'sent' } -- uma resposta de sucesso FALSA -- e por
// isso ninguem percebeu que o Resend recusava 100% dos envios por dominio de
// remetente nao verificado: e-mail de credencial de acesso e aviso de lead novo
// simplesmente sumiam, e a tela dizia que tinha dado certo.
// Agora a falha volta como { success: false, error } para quem chamou decidir.
export const SendEmail = async (params) => {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.functions.invoke('sendEmail', {
        body: params
      });

      if (error) {
        const motivo = await parseInvokeError(error, data);
        console.error('Erro ao enviar email via Edge Function:', motivo);
        return { success: false, error: motivo };
      }

      if (data && data.success === false) {
        console.error('Erro ao enviar email:', data.error);
        return { success: false, error: data.error || 'Falha ao enviar e-mail' };
      }

      return data;
    } catch (err) {
      console.error('Erro ao chamar Edge Function sendEmail:', err);
      return { success: false, error: err?.message || 'Falha ao enviar e-mail' };
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
