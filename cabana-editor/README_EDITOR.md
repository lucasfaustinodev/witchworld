# Witch World — editor isolado da cabana

Bloco de 16/10/2026. Fonte única: `witchworld-art-pass-1-entrega.zip`.
Esta cópia não substitui o laboratório R3F v4, Jardim v44, GitHub ou Vercel.
Este README e `docs/quaternius-validation.json` descrevem o estado atual. `docs/editor-validation.json` e os outros relatórios anteriores são históricos.

## Abrir

Acesse https://witchworld-cabana-editor-lab.lucas-alves-faustino.chatgpt.site/ no navegador. O editor funciona no cloud; nenhuma instalação no computador do usuário é necessária.

## Usar

1. Clique em **Editar móveis e objetos**.
2. Selecione na cena ou na árvore. **Shift + clique** seleciona o conjunto principal.
3. **Mover (W)**: arraste o objeto no plano do piso ou use as alças X/Z do TransformControls. O arraste preserva a altura; use o campo Y para posicionar props sobre móveis.
4. **Altura (H)**: use a seta vertical ou o campo **Altura (Y)**. **Girar (R)** usa o anel vertical ou o campo em graus. **Tamanho (S)** redimensiona proporcionalmente pelas alças ou pelo campo **Tamanho (%)**, entre 5% e 1.000% do tamanho original. Os botões ±10% também ajustam o tamanho.
5. As coordenadas de um prop vinculado são relativas ao conjunto indicado no painel. Mover/girar um móvel leva seus filhos junto; eles continuam editáveis individualmente.
6. **Duplicar item** cria uma cópia ao lado e a seleciona. Conjuntos levam seus props, livros, velas e caveira junto. A cópia mantém altura, giro e tamanho; pode ser movida e editada separadamente. **Excluir objeto** e **Ocultar** preservam o item na árvore e no JSON. Use **Restaurar objeto**, **Mostrar** ou desfazer. Exclusão/visibilidade do conjunto também afeta seus filhos.
7. Cada arraste completo ocupa um passo do histórico. Ctrl/⌘ Z desfaz; Ctrl/⌘ Shift Z ou Ctrl Y refaz. Delete exclui. Esc cancela o arraste ou remove a seleção. Atalhos não interceptam campos de texto/números.
8. **Exportar JSON** guarda a composição completa. **Importar JSON** restaura transformações, tamanho, visibilidade, exclusões e cópias; versão, IDs, hierarquia e números são validados antes de qualquer mudança. JSON v3 inclui as cópias e sua origem. Layouts v1/v2 antigos continuam aceitos: a janela e as cinco lamparinas são adicionadas na posição original e a cortina mantém a posição que tinha no JSON. Layouts v1 usam tamanho original (100%).
9. **Restaurar layout original** também pode ser desfeito. **Concluir edição** oculta ferramentas e mantém a composição.

Sem localStorage, gravação automática ou alteração dos fontes pelos controles. Ao fechar/recarregar, o estado se perde: exporte o JSON antes. Histórico de 100 operações. `public/layouts/cabin-original-v1.json` contém a composição padrão.

## Alterações

### Substituição de assets — 17/10/2026

- 82 objetos receberam geometrias do Fantasy Props MegaKit Standard (Quaternius, CC0): cama, escrivaninha, cadeira, armário, baú, duas prateleiras, caldeirão, 44 livros, cinco pilhas de livros, 16 frascos e nove corpos de velas.
- A estrutura da estante foi mantida: o modelo do pacote interceptava plantas e livros na composição existente. Poltrona, lamparinas completas, janela, banners, plantas, tapetes, arquitetura e duas pinturas originais também foram preservados.
- 139 IDs e hierarquia idênticos. Altura, escala, giro, movimento, duplicação, exclusão reversível, histórico e JSON v1/v2/v3 usam os mesmos dados; importar uma composição anterior troca apenas a geometria correspondente.
- Materiais do pacote adaptados para madeira escura, metal fosco e roupa de cama ameixa, mantendo UVs e pintura autoral dos assets. A cama teve o pé reduzido para deixar o tecido visível; prateleiras mantêm suas superfícies de apoio. Líquido, menisco, luz violeta e chamas existentes foram preservados. O líquido foi ajustado à abertura interna do novo caldeirão.
- 14 modelos em um GLB de aproximadamente 1,03 MB, quatro texturas compartilhadas em WebP 1024. Sem normal/ORM maps, novas dependências de runtime ou novos emissores. Assets importados continuam instanciados.
- Métricas e lista dos IDs substituídos em `docs/quaternius-validation.json`. A contagem de triângulos não é uma medição de FPS.
- Para reproduzir apenas a preparação offline: `scripts/prepare-quaternius.mjs` recebe o diretório extraído do pacote e um diretório separado com `@gltf-transform/core`, `@gltf-transform/extensions`, `@gltf-transform/functions` e `sharp`. O build comum usa o GLB já incluído e não instala essas ferramentas.

### Editor e Art Pass anteriores

- Cama: dobras amplas, afastamento do colchão e da dobra superior, recortes mais uniformes das mesmas pinturas. Colchão e almofadas usam acabamentos exclusivos da cama. Nenhum PNG aprovado foi refeito.
- Dois banners: crescentes com arcos circulares, concavidade aberta, pontas limpas e fio dourado fosco. Demais luas preservadas.
- 139 objetos e conjuntos editáveis no layout padrão. Props pequenos, livros, plantas, frascos, velas e caveira GLB têm IDs estáveis. Cópias reutilizam as geometrias, pinturas e materiais, com identificação independente para seleção.
- Janela (incluindo moldura, vidro, peitoril e cortinas) e cinco lamparinas editáveis. A lua branca no vidro e os 16 pontinhos do lençol foram removidos. As luas dos banners e outros bordados permanecem.
- Paredes, piso, vigas, lareira de alvenaria e postes da entrada protegidos. As fontes de luz já existentes da janela, biblioteca, escrivaninha e caldeirão acompanham seus conjuntos, incluindo cópias.
- Um Canvas e um pipeline. Sem gameplay, física, progressão ou novas dependências.

## Verificações e limites

`npm run typecheck`, `npm test`, `npm run build`, `npm run verify:snapshot`.
Smoke da interface sem navegador:

```bash
node node_modules/vite/bin/vite.js build --ssr tests/editor-ui-smoke.tsx --outDir .checks/editor-ui
node .checks/editor-ui/editor-ui-smoke.js
```

Os testes verificam estado, histórico, JSON, transformações pai/filho, visibilidade/giro do TransformControls real, geometria de tecidos/luas e regressões existentes. O smoke SSR verifica o HTML; não simula cliques ou WebGL.

**QA pendente do usuário:** aparência, seleção/arraste/anel no navegador, mobile/touch, console, WebGL e desempenho em GPU. Browser de QA não disponível nesta execução. O aviso de bundle acima de 500 kB permanece.

O editor permite sobreposição e posições fora do piso: composição livre, sem colisões ou integração de gameplay nesta rodada.

Limites: 1.024 objetos no layout, contando os props dos conjuntos. Até 12 emissores de luz adicionais para cópias; as chamas das demais lamparinas continuam visíveis. O limite evita ultrapassar o orçamento de luzes do shader. As três lamparinas decorativas que já não tinham luz própria mantêm esse comportamento.
