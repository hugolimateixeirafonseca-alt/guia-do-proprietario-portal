# Emails do Sender

## Email de entrega do guia

Ficheiro: `email-0-guia-vender-casa.html`

- Remetente: `Guia do Proprietário <geral@guiadoproprietario.pt>`
- Assunto: `O seu guia "Vender a Casa em Portugal"`
- Preheader: `O guia para preparar a venda da sua casa já está disponível.`
- Botão principal: `Abrir o guia gratuito`
- Endereço do PDF: `https://guiadoproprietario.pt/ebooks/vender-a-casa-em-portugal-3f9a2c.pdf`
- Cancelamento: variável do Sender `{$unsubscribe_link}`

O HTML deve ser colado no editor de código do Sender. Antes de ativar a automação, enviar um teste para computador e telemóvel e confirmar o botão do guia, o simulador e o cancelamento.

## Modelo reutilizável

Ficheiro: `template-base.html`

Alterar apenas:

1. o conteúdo de `<title>`;
2. o texto escondido de pré-visualização;
3. o título principal;
4. o conteúdo entre `INÍCIO DO CORPO EDITÁVEL` e `FIM DO CORPO EDITÁVEL`;
5. o endereço e o texto do botão.

Manter o cabeçalho, a assinatura, a explicação da subscrição e o rodapé de cancelamento.
