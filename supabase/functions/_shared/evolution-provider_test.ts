import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { EvolutionProvider } from "./providers/evolution.ts";

Deno.test("Evolution keeps inbound and echoed outbound messages in the customer conversation", async () => {
  const provider = new EvolutionProvider();
  const encode = (fromMe: boolean) => new TextEncoder().encode(JSON.stringify({
    event: "messages.upsert",
    instance: "company-instance",
    data: {
      key: { id: fromMe ? "out-1" : "in-1", remoteJid: "5511999999999@s.whatsapp.net", fromMe },
      messageType: "conversation",
      message: { conversation: fromMe ? "Resposta" : "Oi" },
    },
  })).buffer;

  const inbound = await provider.receive(new Request("https://example.test"), encode(false), {});
  const outbound = await provider.receive(new Request("https://example.test"), encode(true), {});

  assertEquals(inbound[0].senderId, "5511999999999");
  assertEquals(outbound[0].senderId, "5511999999999");
  assertEquals(outbound[0].fromMe, true);
});

Deno.test("Evolution ignores group messages before automation and persistence", async () => {
  const provider = new EvolutionProvider();
  const payload = new TextEncoder().encode(JSON.stringify({
    event: "messages.upsert",
    instance: "company-instance",
    data: {
      key: { id: "group-1", remoteJid: "120363000000000000@g.us", fromMe: false },
      messageType: "conversation",
      message: { conversation: "Mensagem do grupo" },
    },
  })).buffer;

  assertEquals(await provider.receive(new Request("https://example.test"), payload, {}), []);
});
