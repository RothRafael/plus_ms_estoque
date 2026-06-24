# Logs de Uso de IA — plus_ms_estoque

## Ferramenta

**Claude Code** (Anthropic, modelo Claude Sonnet 4.6), usado por **jucewicz** (Grupo 16 — Stock Service, responsável pelo `plus-mfe-estoque`). O uso aconteceu a partir do desenvolvimento do microfrontend: ao validar a integração ponta-a-ponta, ficaram claras lacunas no backend (`plus_ms_estoque`, mantido por **RothRafael**) que bloqueavam funcionalidades do domínio e critérios de avaliação. Como não há permissão de push no repositório original, todo o trabalho foi feito num fork (`jucewicz/plus_ms_estoque`), sem nenhuma alteração aplicada diretamente no repositório do colega sem revisão.

## O que foi pedido e o que foi produzido

1. **Endpoint de histórico global** — `GET /estoque/movimentos?desde=&ate=`, retornando movimentações de todas as roupas (não só uma), ordenadas por data, para alimentar uma tela de "histórico completo" no MFE.
2. **Cobertura de testes** — antes desta sessão, `test/unit/` não existia. Foram adicionados 25 testes unitários (100% de cobertura de `estoqueService.ts`) e 7 testes funcionais (Docker real, via `test/functional/`).
3. **Pipeline de CI** — o único workflow existente (`container-health.yaml`) só validava se o container subia; não rodava `npm test`. Foi substituído por um pipeline com 3 jobs: testes (unitários + build + funcionais) → health-check do container → publicação da imagem no GHCR (usando `GITHUB_TOKEN`, sem precisar de credenciais externas).
4. Esta própria pasta de logs.

## Crítica

### O que funcionou bem

- Para código novo e isolado (a função `listarTodosMovimentos`, os testes), a IA foi rápida e o resultado, depois de revisão, estava correto e bem coberto por teste — o ciclo TDD (escrever teste, ver falhar, implementar, ver passar) expôs rapidamente quando a implementação não batia com o esperado.
- A IA identificou sozinha, lendo o `ADR.md` e o código do MS de Produtos (outro repositório), que a integração "Produtos chama Estoque" descrita no ADR-001 não tem nenhuma implementação real do lado de Produtos — uma lacuna que não estava documentada antes.

### Erros que a IA cometeu e precisaram de correção

- **Ordem de rotas no Express**: a primeira tentativa de registrar `GET /movimentos` foi colocada *depois* de `GET /:roupaId` — nesse caso a rota nova nunca seria alcançada (o parâmetro `:roupaId` capturaria a string `"movimentos"` antes). O erro só foi percebido porque a validação manual com `curl` contra um container Docker real foi exigida antes de aceitar a implementação como pronta — testar "no papel" (lendo o código) não bastou.
- Em outras partes do trabalho conjunto com o MFE, a IA várias vezes declarou algo como "deveria funcionar" e só a execução real (build Docker, curl, Playwright) revelou problemas reais (variável de ambiente de build vs. runtime, CORS, export default vs. nomeado). Isso reforça que **afirmação da IA de que algo funciona não substitui evidência de execução**.

### Riscos de aceitar sem revisão

- A IA **escreveu os próprios testes** que validam o próprio código que ela mesma implementou. Isso tem viés inerente: é fácil testar "o que foi escrito" em vez de "o que deveria ser verdade" segundo a regra de negócio. A leitura humana dos casos de teste (não só rodar e ver "passou") é necessária para garantir que os testes não estão apenas confirmando um comportamento errado.
- A IA não tem acesso ao repositório real do MS de Produtos além do que está publicado publicamente, nem pode confirmar se/quando esse time vai implementar a chamada para `POST /estoque`. Qualquer suposição sobre essa integração funcionando de ponta a ponta ainda depende de validação manual quando os dois serviços estiverem de fato integrados.

### Decisão humana mantida

- A IA não tinha (e não buscou burlar) permissão de push no repositório original — todo o trabalho ficou num fork, e a abertura de Pull Request para o mantenedor real foi deixada como decisão explícita do humano responsável, não automatizada.
