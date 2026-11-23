// notify-pedido v7 — adiciona detecção de itens_revisados_em
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const FROM = "Polo Wear <nao-responda@info.portalpolowear.com.br>";
const PORTAL_URL = "https://www.portalpolowear.com.br";
const LOGO_URL = `${PORTAL_URL}/logo-polowear.png`;

const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function verifySecret(req: Request): Promise<boolean> {
  const provided = req.headers.get("x-webhook-secret");
  if (!provided) return false;
  const { data } = await supa.from("app_settings").select("value").eq("key", "notification_webhook_secret").maybeSingle();
  return !!data?.value && data.value === provided;
}

type SendResult = { id: string | null; status?: number; error?: unknown; keyPrefix?: string };

async function sendMail(to: string, subject: string, html: string): Promise<SendResult> {
  if (!to) return { id: null, error: "no recipient" };
  const keyPrefix = RESEND_API_KEY ? RESEND_API_KEY.substring(0, 8) + "..." : "<UNSET>";
  if (!RESEND_API_KEY) return { id: null, error: "RESEND_API_KEY unset", keyPrefix };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html })
  });
  const data = await res.json();
  if (!res.ok) return { id: null, status: res.status, error: data, keyPrefix };
  return { id: data.id ?? null, status: res.status, keyPrefix };
}

async function isAlreadySent(pedidoId: string, eventKey: string, recipient: string): Promise<boolean> {
  const { data } = await supa.from("pedido_notifications_sent").select("id").eq("pedido_id", pedidoId).eq("event_key", eventKey).eq("recipient", recipient).maybeSingle();
  return !!data;
}

async function markSent(pedidoId: string, eventKey: string, recipient: string, send: SendResult, extra: Record<string, unknown>) {
  const { error } = await supa.from("pedido_notifications_sent").insert({
    pedido_id: pedidoId, event_key: eventKey, recipient,
    resend_message_id: send.id,
    payload_summary: { ...extra, send_status: send.status, send_error: send.error, key_prefix: send.keyPrefix }
  });
  if (error) console.error("[markSent] erro:", error);
}

async function getUserById(userId: string) {
  if (!userId) return null;
  const { data } = await supa.from("users").select("email, full_name").eq("id", userId).maybeSingle();
  return data ? { email: data.email, name: data.full_name ?? "" } : null;
}

async function getFornecedorEmails(fornecedorId: string): Promise<string[]> {
  if (!fornecedorId) return [];
  const { data } = await supa.from("users").select("email").eq("fornecedor_id", fornecedorId).eq("tipo_negocio", "fornecedor").eq("ativo", true);
  return (data ?? []).map((r: { email: string }) => r.email).filter(Boolean);
}

function pedidoNum(p: { id: string }): string { return `#${String(p.id).slice(-8).toUpperCase()}`; }
function brl(v: number | string | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));
}
function firstName(full: string | null | undefined): string { return (full ?? "").trim().split(/\s+/)[0] ?? ""; }
function escapeHtml(s: string | null | undefined): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]!));
}

const STATUS_ORDER = ["novo_pedido", "em_producao", "faturado", "em_transporte", "entregue"];
const STATUS_LABELS: Record<string, string> = {
  novo_pedido: "Recebido", em_producao: "Em produção", faturado: "Faturado",
  em_transporte: "A caminho", entregue: "Entregue"
};

function timelinePedido(currentStatus: string): string {
  if (currentStatus === "cancelado") return "";
  const idx = STATUS_ORDER.indexOf(currentStatus);
  if (idx < 0) return "";
  const cells = STATUS_ORDER.map((s, i) => {
    const passed = i < idx;
    const current = i === idx;
    const dotColor = current ? "#1d4ed8" : passed ? "#16a34a" : "#d1d5db";
    const textColor = current ? "#1d4ed8" : passed ? "#1a1a1a" : "#9a9a9a";
    const fontWeight = current ? "700" : "500";
    const symbol = passed ? "✓" : String(i + 1);
    return `<td align="center" style="padding:0 2px;width:20%;vertical-align:top;"><div style="width:28px;height:28px;line-height:28px;border-radius:50%;background-color:${dotColor};color:#ffffff;font-size:13px;font-weight:700;margin:0 auto;">${symbol}</div><p style="margin:6px 0 0;font-size:11px;color:${textColor};font-weight:${fontWeight};line-height:1.3;">${STATUS_LABELS[s]}</p></td>`;
  }).join("");
  return `<div style="background-color:#ffffff;border:1px solid #e5e5e5;border-radius:8px;padding:16px;margin:16px 0;"><p style="margin:0 0 12px;font-size:11px;color:#7a7a7a;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Progresso do pedido</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table></div>`;
}

function pixInfoBlock(pixInfo: string): string {
  if (!pixInfo) return "";
  return `<div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:16px 0;">
    <p style="margin:0 0 8px;font-size:14px;color:#1d4ed8;font-weight:700;">Dados para pagamento via PIX</p>
    <p style="margin:0 0 12px;font-size:13px;color:#4a4a4a;">Use a chave ou o código copia-e-cola abaixo para pagar:</p>
    <div style="background-color:#ffffff;border:1px solid #e5e5e5;border-radius:6px;padding:12px;font-family:'Courier New',monospace;font-size:12px;color:#1a1a1a;word-break:break-all;white-space:pre-wrap;">${escapeHtml(pixInfo)}</div>
    <div style="margin-top:12px;background-color:#fef3c7;border-left:3px solid #f59e0b;border-radius:6px;padding:12px;">
      <p style="margin:0 0 6px;font-size:13px;color:#92400e;font-weight:700;">Depois de pagar</p>
      <p style="margin:0;font-size:13px;color:#4a4a4a;line-height:1.5;">Entre no portal em <a href="${PORTAL_URL}/CarteiraFinanceira" style="color:#1d4ed8;text-decoration:underline;font-weight:600;">Carteira Financeira</a> para <strong>informar o pagamento</strong> e <strong>enviar o comprovante</strong>. Sem essa confirmação, o fornecedor não consegue dar baixa no seu pedido.</p>
    </div>
  </div>`;
}

type TplProps = { preheader: string; heading: string; greeting?: string; intro: string; detalhes?: string; timeline?: string; pixBlock?: string; ctaText: string; ctaUrl: string; outro?: string; accentColor?: string; };
function tpl(p: TplProps): string {
  const accent = p.accentColor ?? "#1d4ed8";
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(p.heading)} · Polo Wear</title></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
<span style="display:none;font-size:0;line-height:0;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(p.preheader)}</span>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f5f5f5;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
<tr><td align="center" style="padding:40px 32px 24px;background-color:#000000;"><img src="${LOGO_URL}" width="120" height="120" alt="Polo Wear" style="display:block;border:0;outline:none;text-decoration:none;"></td></tr>
<tr><td style="padding:40px 40px 8px;">
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#1a1a1a;font-weight:600;">${escapeHtml(p.heading)}</h1>
${p.greeting ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#4a4a4a;">${escapeHtml(p.greeting)}</p>` : ""}
<p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#4a4a4a;">${p.intro}</p>
${p.detalhes ?? ""}
${p.timeline ?? ""}
${p.pixBlock ?? ""}
</td></tr>
<tr><td align="center" style="padding:8px 40px 32px;"><a href="${p.ctaUrl}" style="display:inline-block;background-color:${accent};color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:14px 32px;border-radius:8px;">${escapeHtml(p.ctaText)}</a></td></tr>
${p.outro ? `<tr><td style="padding:0 40px 32px;"><p style="margin:0;font-size:14px;line-height:1.6;color:#7a7a7a;">${p.outro}</p></td></tr>` : ""}
<tr><td align="center" style="padding:24px 40px;background-color:#fafafa;border-top:1px solid #e5e5e5;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#9a9a9a;">© Polo Wear · Portal B2B</p>
<p style="margin:4px 0 0;font-size:12px;line-height:1.5;color:#9a9a9a;">E-mail automático — não responda esta mensagem.</p>
</td></tr></table></td></tr></table></body></html>`;
}
function detalhesPedido(p: any): string {
  const valor = brl(p.valor_final ?? p.valor_total);
  return `<div style="background-color:#f5f7fb;border-radius:8px;padding:16px;margin:16px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="50%" style="padding:4px 0;"><p style="margin:0;font-size:13px;color:#7a7a7a;">Pedido</p><p style="margin:0;font-size:18px;font-weight:600;color:#1a1a1a;">${escapeHtml(pedidoNum(p))}</p></td><td width="50%" style="padding:4px 0;"><p style="margin:0;font-size:13px;color:#7a7a7a;">Valor total</p><p style="margin:0;font-size:18px;font-weight:600;color:#1a1a1a;">${escapeHtml(valor)}</p></td></tr></table></div>`;
}
function maybePixBlock(p: any): string {
  if (p?.metodo_pagamento !== "pix") return "";
  if (p?.status_pagamento === "pago") return "";
  if (!p?.pix_info) return "";
  return pixInfoBlock(String(p.pix_info));
}
async function sendIfNew(pedidoId: string, eventKey: string, recipient: string, build: () => { subject: string; html: string }, summary: Record<string, unknown> = {}) {
  if (!recipient) return;
  if (await isAlreadySent(pedidoId, eventKey, recipient)) return;
  const { subject, html } = build();
  const result = await sendMail(recipient, subject, html);
  await markSent(pedidoId, eventKey, recipient, result, { ...summary, subject });
}

async function onPedidoCriado(p: any) {
  for (const email of await getFornecedorEmails(p.fornecedor_id)) {
    await sendIfNew(p.id, "pedido_criado", email, () => ({
      subject: `Novo pedido recebido · ${pedidoNum(p)} · Polo Wear`,
      html: tpl({ preheader: `Você recebeu um novo pedido ${pedidoNum(p)}`, heading: "Novo pedido recebido", greeting: "Olá,", intro: `Você acabou de receber um novo pedido pelo Portal Polo Wear. Acesse para revisar e aprovar.`, detalhes: detalhesPedido(p), timeline: timelinePedido("novo_pedido"), ctaText: "Ver pedido", ctaUrl: `${PORTAL_URL}/PedidosFornecedor` })
    }));
  }
}

async function onStatusChange(p: any) {
  const cliente = await getUserById(p.comprador_user_id);
  if (!cliente?.email) return;
  const nome = firstName(cliente.name);
  const cfg: Record<string, any> = {
    em_producao: { event: "status:em_producao", subject: `Pedido aceito · ${pedidoNum(p)} · Polo Wear`, heading: "Seu pedido foi aceito", intro: `Boa notícia! O pedido <strong>${escapeHtml(pedidoNum(p))}</strong> foi aceito pelo fornecedor e já está em produção.`, cta: "Acompanhar pedido", ctaUrl: `${PORTAL_URL}/MeusPedidos` },
    faturado: { event: "status:faturado", subject: `Pedido faturado · ${pedidoNum(p)} · Polo Wear`, heading: "Pedido faturado", intro: `Seu pedido <strong>${escapeHtml(pedidoNum(p))}</strong> foi faturado. A Nota Fiscal ficará disponível no portal.`, cta: "Ver pedido", ctaUrl: `${PORTAL_URL}/MeusPedidos` },
    em_transporte: { event: "status:em_transporte", subject: `Pedido a caminho · ${pedidoNum(p)} · Polo Wear`, heading: "Seu pedido saiu para entrega", intro: `O pedido <strong>${escapeHtml(pedidoNum(p))}</strong> já está a caminho. Você pode acompanhar pelo portal.`, cta: "Acompanhar", ctaUrl: `${PORTAL_URL}/MeusPedidos` },
    entregue: { event: "status:entregue", subject: `Pedido entregue · ${pedidoNum(p)} · Polo Wear`, heading: "Pedido entregue", intro: `Seu pedido <strong>${escapeHtml(pedidoNum(p))}</strong> foi entregue. Obrigado por comprar com a Polo Wear!`, cta: "Ver detalhes", ctaUrl: `${PORTAL_URL}/MeusPedidos`, accent: "#16a34a" },
    cancelado: { event: "status:cancelado", subject: `Pedido cancelado · ${pedidoNum(p)} · Polo Wear`, heading: "Pedido cancelado", intro: `O pedido <strong>${escapeHtml(pedidoNum(p))}</strong> foi cancelado.${p.motivo_recusa ? ` <br/><br/><strong>Motivo:</strong> ${escapeHtml(p.motivo_recusa)}` : ""}`, cta: "Ver detalhes", ctaUrl: `${PORTAL_URL}/MeusPedidos`, accent: "#dc2626", noTimeline: true }
  };
  const c = cfg[String(p.status)]; if (!c) return;
  await sendIfNew(p.id, c.event, cliente.email, () => ({ subject: c.subject, html: tpl({ preheader: `Status do pedido ${pedidoNum(p)}`, heading: c.heading, greeting: nome ? `Olá ${nome},` : "Olá,", intro: c.intro, detalhes: detalhesPedido(p), timeline: c.noTimeline ? "" : timelinePedido(String(p.status)), pixBlock: maybePixBlock(p), ctaText: c.cta, ctaUrl: c.ctaUrl, accentColor: c.accent }) }));
}

async function onPagamentoPago(p: any) {
  const cliente = await getUserById(p.comprador_user_id); if (!cliente?.email) return;
  const nome = firstName(cliente.name);
  await sendIfNew(p.id, "pagamento:pago", cliente.email, () => ({
    subject: `Pagamento confirmado · ${pedidoNum(p)} · Polo Wear`,
    html: tpl({ preheader: `Pagamento confirmado`, heading: "Pagamento confirmado", greeting: nome ? `Olá ${nome},` : "Olá,", intro: `O pagamento do pedido <strong>${escapeHtml(pedidoNum(p))}</strong> foi confirmado. Obrigado!`, detalhes: detalhesPedido(p), timeline: timelinePedido(String(p.status ?? "em_producao")), ctaText: "Ver carteira", ctaUrl: `${PORTAL_URL}/CarteiraFinanceira`, accentColor: "#16a34a" })
  }));
}

async function onBoletoAdded(p: any) {
  const cliente = await getUserById(p.comprador_user_id); if (!cliente?.email) return;
  const nome = firstName(cliente.name);
  await sendIfNew(p.id, "boleto:added", cliente.email, () => ({
    subject: `Boleto disponível · ${pedidoNum(p)} · Polo Wear`,
    html: tpl({ preheader: `Boleto do pedido ${pedidoNum(p)}`, heading: "Boleto disponível", greeting: nome ? `Olá ${nome},` : "Olá,", intro: `O boleto referente ao pedido <strong>${escapeHtml(pedidoNum(p))}</strong> já está disponível no portal.`, detalhes: detalhesPedido(p), timeline: timelinePedido(String(p.status ?? "em_producao")), ctaText: "Acessar boleto", ctaUrl: `${PORTAL_URL}/MeusPedidos` })
  }));
}

async function onPixAdded(p: any) {
  const cliente = await getUserById(p.comprador_user_id); if (!cliente?.email) return;
  const nome = firstName(cliente.name);
  await sendIfNew(p.id, "pix:added", cliente.email, () => ({
    subject: `Dados de PIX disponíveis · ${pedidoNum(p)} · Polo Wear`,
    html: tpl({ preheader: `Dados de PIX do pedido ${pedidoNum(p)}`, heading: "Dados de PIX disponíveis", greeting: nome ? `Olá ${nome},` : "Olá,", intro: `O fornecedor cadastrou os dados de PIX do pedido <strong>${escapeHtml(pedidoNum(p))}</strong>. Veja abaixo as instruções para pagamento:`, detalhes: detalhesPedido(p), pixBlock: pixInfoBlock(String(p.pix_info ?? "")), timeline: timelinePedido(String(p.status ?? "em_producao")), ctaText: "Informar pagamento", ctaUrl: `${PORTAL_URL}/CarteiraFinanceira` })
  }));
}

async function onNfAdded(p: any) {
  const cliente = await getUserById(p.comprador_user_id); if (!cliente?.email) return;
  const nome = firstName(cliente.name);
  await sendIfNew(p.id, "nf:added", cliente.email, () => ({
    subject: `Nota Fiscal disponível · ${pedidoNum(p)} · Polo Wear`,
    html: tpl({ preheader: `NF do pedido ${pedidoNum(p)}`, heading: "Nota Fiscal disponível", greeting: nome ? `Olá ${nome},` : "Olá,", intro: `A Nota Fiscal do pedido <strong>${escapeHtml(pedidoNum(p))}</strong> foi emitida e está disponível para download.`, detalhes: detalhesPedido(p), timeline: timelinePedido(String(p.status ?? "faturado")), ctaText: "Baixar Nota Fiscal", ctaUrl: `${PORTAL_URL}/MeusPedidos` })
  }));
}

// Novo: itens revisados manualmente por admin/fornecedor
async function onItensRevisados(p: any) {
  const cliente = await getUserById(p.comprador_user_id);
  if (!cliente?.email) return;
  const nome = firstName(cliente.name);
  // event_key distinto por timestamp para permitir múltiplas revisões
  const eventKey = `itens_revisados:${p.itens_revisados_em}`;
  await sendIfNew(p.id, eventKey, cliente.email, () => ({
    subject: `Itens do pedido revisados · ${pedidoNum(p)} · Polo Wear`,
    html: tpl({
      preheader: `Os itens do pedido ${pedidoNum(p)} foram ajustados`,
      heading: "Itens do pedido revisados",
      greeting: nome ? `Olá ${nome},` : "Olá,",
      intro: `Os itens do pedido <strong>${escapeHtml(pedidoNum(p))}</strong> foram revisados pelo Polo Wear. Acesse o portal para conferir as novas quantidades e o valor atualizado.`,
      detalhes: detalhesPedido(p),
      timeline: timelinePedido(String(p.status ?? "novo_pedido")),
      pixBlock: maybePixBlock(p),
      ctaText: "Ver pedido",
      ctaUrl: `${PORTAL_URL}/MeusPedidos`,
      outro: "Se você não solicitou essa alteração, entre em contato imediatamente com nosso comercial."
    })
  }));
}

async function onComprovanteEnviado(c: any, p: any) {
  for (const email of await getFornecedorEmails(p.fornecedor_id)) {
    await sendIfNew(p.id, `comprovante:uploaded:${c.id}`, email, () => ({
      subject: `Comprovante recebido · ${pedidoNum(p)} · Polo Wear`,
      html: tpl({ preheader: `Cliente enviou comprovante`, heading: "Comprovante recebido", greeting: "Olá,", intro: `O cliente enviou um comprovante referente ao pedido <strong>${escapeHtml(pedidoNum(p))}</strong>. Acesse o portal para revisar.`, detalhes: detalhesPedido(p), ctaText: "Revisar comprovante", ctaUrl: `${PORTAL_URL}/CarteiraFinanceira` })
    }));
  }
}

async function onComprovanteRecusado(c: any, p: any) {
  const cliente = await getUserById(p.comprador_user_id); if (!cliente?.email) return;
  const nome = firstName(cliente.name);
  await sendIfNew(p.id, `comprovante:recusado:${c.id}`, cliente.email, () => ({
    subject: `Comprovante recusado · ${pedidoNum(p)} · Polo Wear`,
    html: tpl({ preheader: `Comprovante recusado`, heading: "Comprovante recusado", greeting: nome ? `Olá ${nome},` : "Olá,", intro: `O comprovante referente ao pedido <strong>${escapeHtml(pedidoNum(p))}</strong> foi recusado.${c.motivo_recusa_comprovante ? `<br/><br/><strong>Motivo:</strong> ${escapeHtml(c.motivo_recusa_comprovante)}` : ""} Acesse a carteira para reenviar.`, detalhes: detalhesPedido(p), pixBlock: maybePixBlock(p), ctaText: "Reenviar comprovante", ctaUrl: `${PORTAL_URL}/CarteiraFinanceira`, accentColor: "#dc2626" })
  }));
}

async function onComprovanteAprovado(c: any, p: any) {
  const cliente = await getUserById(p.comprador_user_id); if (!cliente?.email) return;
  const nome = firstName(cliente.name);
  await sendIfNew(p.id, `comprovante:aprovado:${c.id}`, cliente.email, () => ({
    subject: `Pagamento confirmado · ${pedidoNum(p)} · Polo Wear`,
    html: tpl({ preheader: `Pagamento aprovado`, heading: "Pagamento confirmado", greeting: nome ? `Olá ${nome},` : "Olá,", intro: `O pagamento referente ao pedido <strong>${escapeHtml(pedidoNum(p))}</strong> foi confirmado pelo fornecedor. Obrigado!`, detalhes: detalhesPedido(p), timeline: timelinePedido(String(p.status ?? "em_producao")), ctaText: "Ver carteira", ctaUrl: `${PORTAL_URL}/CarteiraFinanceira`, accentColor: "#16a34a" })
  }));
}

async function processPedido(type: string, oldR: any, newR: any) {
  if (type === "INSERT" && newR) { await onPedidoCriado(newR); return; }
  if (type === "UPDATE" && oldR && newR) {
    if (oldR.status !== newR.status && newR.status) await onStatusChange(newR);
    if (oldR.status_pagamento !== newR.status_pagamento && newR.status_pagamento === "pago") await onPagamentoPago(newR);
    if (!oldR.boleto_url && newR.boleto_url) await onBoletoAdded(newR);
    if (!oldR.pix_info && newR.pix_info) await onPixAdded(newR);
    if (!oldR.nf_url && newR.nf_url) await onNfAdded(newR);
    // Itens revisados manualmente: timestamp mudou para algo não-nulo
    if (oldR.itens_revisados_em !== newR.itens_revisados_em && newR.itens_revisados_em) {
      await onItensRevisados(newR);
    }
  }
}

async function processCarteira(type: string, oldR: any, newR: any) {
  if (type !== "UPDATE" || !oldR || !newR || !newR.pedido_id) return;
  const { data: p } = await supa.from("pedidos").select("*").eq("id", newR.pedido_id).maybeSingle();
  if (!p) return;
  if (!oldR.comprovante_url && newR.comprovante_url) await onComprovanteEnviado(newR, p);
  if (!oldR.motivo_recusa_comprovante && newR.motivo_recusa_comprovante) await onComprovanteRecusado(newR, p);
  if (oldR.status !== "pago" && newR.status === "pago") await onComprovanteAprovado(newR, p);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!(await verifySecret(req))) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  try {
    const { type, table, old_record, new_record } = await req.json();
    if (table === "pedidos") await processPedido(type, old_record, new_record);
    else if (table === "carteira") await processCarteira(type, old_record, new_record);
    return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
