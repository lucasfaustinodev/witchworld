# Jardim ritualístico — Bloco 4

Polimento visual controlado sobre os Blocos 1–3 aprovados. A versão do ChatGPT Sites
permanece privada, no mesmo projeto e endereço. Não há Bloco 5 nesta entrega.

## Controles e execução

- WASD ou setas: caminhar na área central, com direção relativa à tela.
- E próximo do centro: sentar para meditar e iniciar o ritual.
- E novamente: apagar os efeitos, descer suavemente e levantar.

No Sites, clique na cena para dar foco ao teclado. A área de movimento continua com
raio de 1,36 unidades; velocidade máxima de 1,10 unidade/s. Movimento permanece
bloqueado durante sentar, meditar, levitar, descer e levantar.

O projeto continua sendo HTML/CSS/JavaScript e Three.js 0.186.1, com biblioteca local
em `vendor/`. Não há instalação npm, CDN, backend, modelos externos ou imagens de animação.
Para uso fora do Sites, sirva esta pasta por um servidor estático, como Live Server
ou `python -m http.server 8000`. É necessário WebGL 2.

## Arquivos alterados

- `character.js`: acabamento da geometria, materiais e drapeado da personagem.
- `main.js`: caveiras, materiais procedurais compartilhados e chanfros do círculo.
- `ritual.js`: apenas formato/inclinação dos pequenos volumes luminosos dos olhos.
- `index.html`: título atualizado para Bloco 4.
- `README.md`: registro da entrega.

CSS, biblioteca, câmera, resize, iluminação, posição dos objetos e sistema de input
não foram alterados. A configuração de hospedagem do Sites foi preservada.

## Personagem

A cabeça conserva tamanho e posição; o rosto ganhou mandíbula suavemente afunilada,
pálpebras curvas, nariz menor e sobrancelhas discretas. Permanece pequeno e sombreado.
As mechas são volumes curvos afunilados, com balanço secundário mínimo, sem fios individuais.

O chapéu conserva a grande aba e a altura geral. A aba tem ondulação controlada; a ponta
usa mais transições de raio e curvatura. As superfícies de anéis recebem UVs e suavização
nas costuras. Não há mudança de escala na raiz da personagem.

A saia passou de três para seis perfis, ganhou caimento mais comprido em pé e uma barra
fina acompanhando suas dobras. O drapeado se comprime ao sentar com o mesmo parâmetro
original de meditação. A capa ganhou um pouco de profundidade, e os ombros/mangas têm
transições mais suaves. As mãos continuam simples, ligeiramente menores.

Os sapatos são menores, com sola mais plana, biqueira macia e borda inferior escura.
A mesma geometria é compartilhada pelo par. O material com cores por vértice fica
restrito aos sapatos; as canelas mantêm material próprio para evitar superfícies pretas
por ausência de atributos. A trajetória, apoio dos pés e posições das pernas cruzadas
continuam sendo calculados pelo sistema aprovado.

## Caveiras e cenário

As cinco caveiras mantêm exatamente suas posições e orientações. Têmporas mais estreitas,
órbitas afundadas e angulares, mandíbula arredondada, boca escura e arcos discretos nas
maçãs reduzem a leitura de máscara redonda. Os brilhos dos olhos são menores e inclinados;
número, cor, sequência de ativação, chamas e luzes do ritual permanecem iguais.

As pedras do círculo têm chanfros com uma subdivisão adicional. Pedra/alvenaria e madeira
usam texturas procedurais pequenas, compartilhadas, com variação muito leve e relevo fino.
Tecido recebe trama de 64 × 64 pixels; pedra e madeira usam 128 × 128 pixels. Roughness
separa tecido, couro, cabelo, osso, madeira e pedra. As cores-base foram preservadas.

A geração de texturas tem sua própria semente, sem consumir a aleatoriedade do layout.
Não foram movidos ou adicionados objetos de cenário. Cabana, arco, ponte, lago, lanternas,
velas, vegetação e flores mantêm a construção e distribuição aprovadas. O lago e a
vegetação não receberam alterações: foram cortados da lapidação para preservar a composição
sem aumentar densidade ou complexidade.

## Iluminação e ritual preservados

Nenhuma luz, posição, cor, intensidade ou exposição global foi alterada. O acabamento
dos materiais melhora a resposta às fontes existentes. A noite continua azul-marinho,
com lanternas âmbar e magia violeta.

O ritual conserva literalmente seu controlador, partículas, luzes e timing. Apenas os
pequenos meshes dos olhos mudaram de proporção. Após sentar: pausa de 0,65 s; ativação
cresce por 2,70 s; levitação até 0,34 unidade com oscilação de 0,01. E encerra com fade
em 0,80 s, descida em 1,05 s e levantar original em aproximadamente 0,95 s.

## Comparação e regressão

Capturas antes/depois foram feitas em 1536 × 1024, DPR 2, com a mesma câmera e estados:
idle, caminhada, meditação antes da magia, ritual ativo e vista geral inativa.
As capturas são renders da aplicação. O relógio do navegador é controlado apenas no QA;
a versão entregue continua usando tempo real e subpassos de até 1/30 s.

- Console sem erros/avisos nos ciclos finais de captura e regressão.
- Idle, walk, stop, sentar, meditar, levitar, ritual ativo, descer, levantar, retornar e reativar exercitados por teclado.
- WASD e as quatro setas; E fora do centro ignorado; bloqueio de movimento durante meditação/ritual.
- Cancelamento durante pausa e ascensão e E repetido durante a saída verificados.
- Movimento a 30/60/120 Hz mantém os mesmos resultados aprovados; 62 amostras de apoio dos pés com deriva inferior a 0,00001 unidade.
- Ritual a 30/60/120 Hz mantém sequência, altura e retorno ao piso equivalentes.
- Vista vertical emulada de 390 × 844 sem overflow horizontal, com ritual ativo.
- Comparação literal de código confirma preservação da câmera/resize, input, movimento, transições, distribuição dos objetos, vegetação, luzes e sequência do ritual.
- Inspeção visual das poses para roupa/pernas, conexão dos membros, sapatos, chapéu, escala e leitura das caveiras/pentagrama.

No mesmo render inicial, incluindo passagens de sombra: 515 → 547 chamadas (+6,2%) e
329.104 → 351.088 triângulos (+6,7%). É um aumento contido de acabamento; não há novo
pós-processamento, novos mapas de sombra ou centenas de meshes adicionais. Isso não é
uma medição de FPS em hardware físico.

## Limitações e regra de parada

O rosto permanece parcialmente oculto pelo chapéu e pela noite. Mãos e articulações
continuam estilizadas; as pernas cruzadas são uma aproximação procedural. Não há simulação
de tecido/cabelo, anatomia de produção ou expressões faciais detalhadas.

A vegetação ainda compartilha uma geometria de folha, a arquitetura tem blocos chanfrados
e as chamas continuam sendo faixas espectrais. Essas são as áreas que mais conservam a
natureza procedural; não foram redesenhadas neste bloco. O ganho principal está na roupa,
pés, transições da silhueta e caveiras; o acabamento periférico é deliberadamente sutil.

A validação visual foi realizada no Chromium local do ambiente cloud com WebGL/SwiftShader.
A automação de Sites neste ambiente não permite abrir a prévia hospedada; controles e
console foram verificados na mesma fonte usada no Site. Nenhum comando foi exigido no
computador do usuário. GPU física, FPS real e Safari/iOS/Android reais não foram validados.
A versão vertical foi apenas emulada e continua sem controles touch, conforme o escopo.

A entrega termina no polimento visual. Nenhuma nova mecânica, animação funcional, ritual,
área, personagem, áudio, diálogo, inventário, save, menu, quest ou progressão foi adicionada.


## Substituição das caveiras pelo GLB anexado — 3 de outubro de 2026

Somente a geometria visual das cinco caveiras foi substituída. `main.js` mantém os mesmos grupos, posições, orientações e ordem; `character.js`, câmera, layout, círculo, iluminação ambiente/âmbar e controles permanecem intactos.

- `assets/ritual-skull.glb`: cópia byte a byte do arquivo fornecido (295.956 bytes).
- `skull-model.js`: GLTFLoader r186, uma promessa de carregamento em cache e cinco clones. Apenas `JR_Caveira_Ritual` é usado; o cubo extra de exportação é ignorado. As duas geometrias são compartilhadas; materiais são clonados por instância para permitir emissão independente.
- `vendor/addons/loaders/GLTFLoader.js` e os utilitários oficiais `BufferGeometryUtils.js`/`SkeletonUtils.js`: mesma versão 0.186.1 do Three.js atual, imports apontando ao vendor local. Não há CDN, Draco, modelos adicionais ou texturas externas.
- Normalização local: removido o offset de exportação do modelo, escala uniforme ~0,1474996, altura de 0,453 unidade e base em 0,012 acima do pivô aprovado. As proporções próprias do GLB são preservadas.
- Osso e cavidades conservam os materiais originais `JR_Osso_Envelhecido` e `JR_Sombra_Orbitas`, incluindo cor, roughness e parâmetros especulares. A emissão no osso interpola discretamente com a mesma ativação do ritual e volta ao valor original ao encerrar.
- `ritual.js`: somente alinhamento dos dois brilhos às cavidades e emissão do material. Nenhuma mudança na pausa, rampas, ordem, intensidade/posição das luzes, chamas, partículas, levitação ou saída.

Validação em Chromium com renderização por software, viewport 1536×1024, DPR 1,75: cinco caveiras; uma requisição GLB inclusive após reativação; duas geometrias compartilhadas; console sem erros/avisos. Comparação antes/depois nos estados inativo, primeira caveira plenamente acesa e ritual completo. Todos os dez snapshots de meditação, sequência, levitação, saída, movimento, E fora do centro, retorno e reativação tiveram os mesmos valores/timing. Transformações dos cinco pivôs e matriz da câmera conferidas iguais. Demais arquivos existentes e GLB conferidos byte a byte.

O frame inicial medido, incluindo sombras, passa de 547 para 437 chamadas de desenho e de 351.088 para 395.068 triângulos. A malha fornecida tem mais triângulos, porém menos peças separadas. Não foi medido FPS em GPU física ou dispositivos reais. A inspeção visual ocorreu no Chromium dentro do ambiente cloud; o navegador automatizado não acessa a URL privada do Sites.


## Checkpoint da nova rodada visual — 5 de outubro de 2026

Esta é uma entrega intermediária: personagem primeiro, depois preenchimento frio.
O polimento do cenário e a revisão final da rodada ainda estão pendentes, conforme
ordem e checkpoint solicitados. Foi usado o fluxo de Three.js/WebGL e playtest do
plugin Game Studio, sem migração de engine ou ferramentas de modelagem externas.

### Superfícies e anatomia

- Torso contínuo com perfis de caixa torácica, cintura e quadril; pescoço com conexão
  entre roupa, cabeça e ombros. Removidos bib circular e ombros esféricos.
- Cabeça deformada em uma superfície: mandíbula afunilada, queixo, bochechas, testa,
  nariz em relevo e órbitas recuadas. Pálpebras, sobrancelhas e boca curvas, expressão
  calma; o rosto continua parcialmente sombreado pela aba.
- Braços/antebraços e coxas/panturrilhas têm perfis afunilados, volumes intermediários
  e sobreposição suave nas articulações. Os pontos de ombro/cotovelo/quadril/joelho,
  solução de apoio dos pés e comprimentos do rig aprovado foram preservados.
- Mãos: palma, polegar e quatro dedos sugeridos em uma malha por mão. Pose visual
  das mãos sentadas ajustada para apoiar nas pernas; não há rig individual de dedos.
- Botas com sola plana escura, biqueira, peito do pé e cano posterior. Geometria
  compartilhada, mesmos pontos de apoio e transformação geral de escala.
- Cabelo em massas achatadas e curvas: parte traseira, laterais e franja. Mesmas
  duas mechas laterais recebem o movimento secundário original.
- Chapéu com cone curvo, faixa de couro e aba orgânica com frente levantada para
  revelar o rosto. Raio da aba, altura geral e escala da raiz continuam iguais.
- Roupa com torso moldado, gola sobreposta, cinto e dobras. Saia sentada forma um
  caimento inclinado sobre as pernas; a capa tem profundidade suficiente para
  acompanhar o vestido sem penetrar sua parte traseira.

O controlador de input, velocidade, limites, estados, gait, apoio dos pés e timing
permanece literal. Só os adaptadores visuais de roupa e mãos sentadas mudaram.
Não há novo sistema de animação, física, controles ou mecânicas.

### Leitura e luz

Tecido, couro e cabelo receberam pequenos ajustes de roughness/valor, mantendo
os matizes. Somente o preenchimento direcional frio existente passou de 0,35
para 0,60. Cor, posição e direção dessa fonte são as mesmas. Nenhuma luz foi
adicionada. Luz da lua, exposição, fontes âmbar e todas as luzes do ritual
continuam intactas. O diorama permanece inequivocamente noturno.

### Métricas intermediárias e validação

Chromium/WebGL2 com SwiftShader, 1536 × 1024, DPR 1,75; chamadas e triângulos
incluem a passagem de sombra. Inativo: 437 → 417 calls, 395.068 → 393.228
triângulos. Ativo: 470 → 450 calls, 397.472 → 395.632 triângulos.
Personagem: 42 → 32 meshes, 15.576 → 14.656 triângulos. Cena: 264 → 254 meshes.
Luzes: 19 → 19, uma fonte com shadow map; partículas: 0 inativo, 75 ativo.
Nenhum novo asset, textura grande, efeito de pós-processamento ou mapa de sombra.

Console sem erros/avisos; WASD e quatro setas; walk/stop/idle; boundary circular de
1,36; E fora do centro ignorado; entrada, meditação, ascensão, estado ativo,
descida/levantar; cancelamento na pausa e repetição do ritual verificados. Uma
requisição GLB inclusive após repetir. Viewport vertical 390 × 844 emulado sem
overflow. Nove snapshots comparados à base: estados, parâmetro de meditação, relógio/linhas/
círculo do ritual, altura, caveiras ativas, câmera e transformações dos cinco pivôs
permanecem iguais. Posição/velocidade na caminhada ficaram dentro de 0,001 unidade
de tolerância entre capturas; o código de movimento não mudou. `ritual.js`, `skull-model.js`, GLB,
CSS e restante do cenário não foram alterados. Capturas reais de idle, caminhada,
meditação, ascensão, ritual ativo e visão geral; close usa cópia da câmera somente
no teste, sem controles ou alterações na versão interativa.

Limitações: anatomia/roupa ainda são estilizadas e procedurais, sem skinning ou
simulação de tecido. Dedos são sugestões estáticas; a pose cruzada usa o rig
aprovado e não tem articulações independentes dos dedos/pés. A personagem mantém
a escala pequena e o rosto sombreado na câmera final. FPS de GPU física,
Safari/iOS/Android reais e sessão autenticada no endereço privado não foram
validados pelo navegador automatizado. O cenário ainda conserva repetição de
folhagem, terreno simples e água básica; essa etapa foi deliberadamente adiada
até a avaliação deste checkpoint.


## Polimento do cenário — 5 de outubro de 2026

Checkpoint da personagem aprovado antes desta etapa. Game Studio (Three.js/WebGL
e playtest) usado para auditoria, materiais, custo de renderização e revisão final.
Solo com variação tonal/bump, três formas de folhas fechadas com volume, pétalas
suaves, grama curva instanciada (241 tufos novos fora do círculo/caminhos), madeira
com veios sutis, pedra com desgaste e lago com ondulações estáticas. Layout, câmera,
personagem, luzes, caveiras GLB, controles e sequência ritualística preservados.

99 setores do piso agrupados em cinco malhas por material: mesmos 16.236 triângulos,
mesmas posições mundiais/UVs em precisão Float32; normais equivalentes a 1e-7.
Material compartilhado para as 24 ondulações antigas. Todas as 5.599 origens das
instâncias anteriores foram preservadas; somente folhas receberam orientação nova.
Texturas/detalhes usam seed separado, sem alterar o gerador de layout aprovado.

Chromium/WebGL2 SwiftShader, 1536 × 1024, DPR 1,75, incluindo passagem de sombra:
inativo 417 → 227 calls, 393.228 → 394.440 triângulos; ativo 450 → 260 calls,
395.632 → 396.844 triângulos. 19 luzes e 0/75 partículas inativo/ativo mantidas.
Malhas 254 → 148. Personagem: 32 malhas/14.656 triângulos, sem alterações.

Console sem erros/avisos; WASD/setas, walk/stop/idle, boundary circular, E fora do
centro, meditação/pausa/levitação/ritual, cancelamento, descida/levantar e repetição
validados. Uma requisição do GLB. Onze snapshots preservam câmera, transformações
das caveiras e parâmetros/estados/timing. character.js, ritual.js, skull-model.js,
GLB, HTML e CSS idênticos em bytes. Viewport vertical emulado sem overflow.

Limitações: folhas/copas/arquitetura ainda estilizadas e procedurais, solo sem
deslocamento físico, água/grama estáticas sem reflexão/refração em tempo real.
Não foram medidos FPS em GPU física, Safari/mobile reais ou navegação autenticada
no endereço privado. Capturas e testes interativos feitos no ambiente cloud.
Nenhuma nova mecânica ou sistema; fim desta rodada de polimento.


## Micro-rodada do ritual — 5 de outubro de 2026

Escopo autorizado: meditação, ascensão, propagação, caveiras/efeitos e iluminação
local. Cenário/câmera/layout/personagem base/controles/estados/timing geral/GLB
preservados. Game Studio (Three.js/WebGL e game-playtest) usado nesta revisão.

character.js: easing quintic da descida e breve acomodação dentro dos mesmos
1,15 s; menor inclinação preparatória; saia sentada com mais profundidade e
interpolação própria, sem nova geometria ou remodelagem da personagem.
ritual.js: easing quintic na ascensão de 0,34 unidade; pulso radial desenhado
na textura existente; anel recebe intensidade ao redor de toda a circunferência;
marcas existentes respondem. Cinco caveiras ativam com a mesma rampa em
1,65 s após despertar, durante 0,34 s. Chamas/luzes com oscilações individuais
posteriores, evitando ignição em cadeia. Partículas: mesmas 75, com 32 no
círculo, 18 perto da personagem e 25 nas caveiras; maior leitura e fade.

Pausa 0,65 s, awakening 2,70 s, E → ativo 4,50 s preservados. Saída mantém
fade 0,80 s, descida 1,05 s e levantar 0,95 s. Luz central violeta existente
9 → 9,8 e entrada mais cedo; outras fontes gerais/âmbar, exposição e câmera
intactas. Sem novas luzes, malhas, texturas, shaders ou passes.

Chromium/WebGL2 SwiftShader, 1536 × 1024, DPR 1,75, incluindo sombra:
inativo 227 calls/394.440 triângulos; ativo 260/396.844, iguais à base.
19 luzes, uma shadow map, 0/75 pontos inativo/ativo. Malhas 148, materiais 89,
geometrias 73, shaders ativos 23: iguais à base. Textura ritual quantizada:
62 → 75 atualizações no ciclo amostrado a 20 fps; sem uploads no plateau.

Validação: console limpo; WASD/setas/walk/stop/idle/boundary; E fora do centro;
meditação/pausa/propagação/ascensão/ativo; cancelar na pausa, na ascensão e
ativo; descer/levantar e repetir. GLB: uma requisição. Capturas inativas
gerais e closes do cenário idênticas em bytes à base; main.js, skull-model.js,
GLB, vendor, HTML e CSS intactos. Câmera, 5.840 matrizes decorativas e raízes
das caveiras iguais. Viewport vertical emulado sem erro/overflow.

Teste temporal a cada 50 ms: olhos das cinco caveiras iniciam juntos em
3,50 s desde E (antes: 3,30/3,40/3,55/3,70/3,85 s). Opacidades iguais
em todas as amostras. Sentado 1,15 s, awakening 1,80 s e ativo 4,50 s iguais
à base. Saia não cruza o piso: altura mínima 0,3091; retorno ao root.y 0,255.

Limitações: roupa procedural sem simulação; chamas em faixas; pulso em plano;
fontes mágicas sem sombras próprias. FPS de GPU física, browsers/mobile
reais e sessão autenticada na prévia não testados. Vídeo de QA amostrado
a 20 fps, sem representar o FPS real do jogo. Fim desta micro-rodada.

## DELUXE 1 — renderização

A apresentação usa `render-pipeline.js`, sem dependência dos estados, input ou relógio do ritual.

Pipeline: RenderPass HDR com depth → contato em meia resolução e bloom seletivo em um quarto de resolução → SMAA linear → OutputPass ACES/sRGB. Quatro passes lógicos; dez etapas de cor em HIGH, incluindo as etapas internas. A única luz com sombra continua usando PCF 2048². `normalBias` passou de .025 para .018 e `radius` de 3 para 2.

Parâmetros: contato com raio .24, intensidade .78 e 12 amostras; bloom .18, blur separável de cinco leituras por direção com passo 1.35. O emissive, alpha e as transformações continuam pertencendo aos materiais originais. A seleção de bloom usa cópias de material temporárias e testa o depth do render base, excluindo lua, osso, vegetação, solo e personagem inteira. Os materiais e layers originais são restaurados ao final do passe.

Perfis exportados em `RENDER_QUALITY`: HIGH (DPR até 1.5, contato/bloom/SMAA), MEDIUM (até 1.25, bloom/SMAA), LOW (até 1, render direto). A abertura em viewport menor que 600 px escolhe MEDIUM. Não há UI de qualidade. `pipeline.configure({contact:false})`, `{bloom:false}`, `{aa:false}`, `{fog:false}` e `{post:false}` desligam cada efeito. `pipeline.configure({quality:'HIGH'})` restaura o preset. Sem suporte a `EXT_color_buffer_float`, há fallback para LOW. LOW não usa anti-aliasing avançado. O canvas não mantém MSAA redundante com SMAA.

A fog navy existente .025 e a exposição ACES 1.15 foram preservadas. O céu procedural conserva a saída sem tone mapping da versão aprovada, usando uma máscara de cobertura na composição; isso evita escurecer o fundo. Não foram criados contact-shadow meshes nem um segundo prepass de toda a cena.

QA: Chromium/WebGL2 no cloud com SwiftShader, 1536×1024, 1366×768 e 390×844. 57 verificações passaram: controles, limite, idle/walk/stop, meditação, pausa, levitação, ritual, cancelamento, levantar, repetir, resize e efeitos/presets individuais. Console sem erros/avisos; um carregamento de GLB por abertura. Sem GPU física e sem timer queries válidas: as métricas de submissão de comandos não estabelecem FPS em hardware real.

Métricas no desktop principal: inativa 227→249 draw calls, 394440→395868 triângulos; ritual 260→315 calls, 396844→400676 triângulos. 19 luzes, 1 com sombra, 98 meshes casters, 75 partículas ativos e 148 meshes da cena preservados. O bloom submete novamente os mesmos pontos: `renderer.info.render.points` passa a contar 150 submissões, sem aumentar a população de 75 partículas. Framebuffer 2688×1792→2304×1536. Contadores de render agora agregam todos os passes do frame, incluindo sombra e máscara de bloom.

Os addons locais são da mesma versão Three.js 0.186.1; nenhum CDN adicional é necessário.


## DELUXE 2 — jardim vivo e familiar

Game Studio: auditoria Three.js/WebGL, pipeline de assets 3D locais, integração, performance e playtest. Câmera, layout, controles, ritual.js, pipeline de renderização e caveiras GLB permanecem preservados.

- `living-garden.js`: vento de baixa amplitude por shader em 32 batches existentes (5.152 instâncias), fases por posição e depth shaders correspondentes. Água original recebe pequenas normais analíticas e deriva dos mapas existentes. Seis lanternas oscilam com fases individuais; nenhuma nova luz. Quatorze vaga-lumes reutilizam um único buffer de Points. Reações usam snapshots do ritual.
- `familiar.js`: gata preta azulada original com volumes orgânicos, olhos verdes, cauda contínua, quatro patas com IK simples e secondary motion. Seis estados: idle, walk, sit, look, follow e ritual. Navegação em arco frontal/esquerdo de raio 3,95; apoio local sobre os pavimentos existentes. Sem navegação complexa ou biblioteca adicional.
- `main.js`: criação única dos dois módulos e atualizações no loop aprovado.
- `character.js`: alvos dos pés ficam do lado anatômico e dentro do alcance das pernas ao virar; orientação das botas acomodada na meditação. Velocidade, input e timing preservados.

QA: 65 verificações, três ciclos completos, cancelamento na pausa e despertar, WASD/setas, limites, retorno, todos os estados da gata, console sem erros/avisos e GLB carregado uma vez. Partículas e objetos não acumulam. Silhueta amostrada da gata mantém distância mínima de 3,525 do centro, fora da plataforma de raio 3.

Cena completa HIGH, 1536×1024 DPR 1,5: idle 249→282 calls, 395868→409452 triângulos; ativo 315→348 calls, 400676→414260 triângulos. Luzes 19→19, instâncias 5840→5840, objetos 198→231. Partículas reais 0→14 idle e 75→89 ativo. Sem novos passes de render.

Limitações: assento baixo estilizado; navegação deliberadamente restrita à faixa segura, sem colisão detalhada de plantas. QA em Chromium/WebGL2 SwiftShader; não estabelece FPS em GPU física ou compatibilidade de aparelhos reais. Nenhum sistema posterior (scrying, portal, Véu, áudio, progressão) implementado.

## DELUXE 3 — lago de vidência

`E` mantém prioridade no círculo. Uma faixa estreita conecta o limite anterior da plataforma à margem do lago (ponto 2.55, 1.15); perto da margem, o mesmo `E` inicia a contemplação. `E` fecha a visão com retorno gradual e libera os controles. Nenhum menu adicional.

`scrying-pond.js` mantém SCRY_IDLE → SCRY_FOCUS (1.15 s) → SCRY_OPENING (3.10 s) → SCRY_VISION; fechar passa por SCRY_CLOSING (1.80 s). O ritual continua em seu módulo original. A contemplação usa inclinação discreta e orientação da personagem, sem nova animação ou modelo.

Uma câmera secundária reutiliza a cena em um único WebGLRenderTarget 512², HDR quando suportado, atualizado no máximo a 12 Hz. Lago, personagem e familiar são ocultados apenas durante esse render; a silhueta está em layer exclusivo. Fog, fundo e estado do renderer retornam por try/finally. Sem recursão, render de sombras adicional ou outro compositor. O alvo é criado na primeira abertura e reutilizado, sem renderizar no estado normal.

A água recebe escurecimento, acalmamento das normais, abertura central, profundidade simulada, distorção e instabilidade nas bordas. O shader evita as leituras da visão enquanto o lago está normal. Oito partículas analíticas em buffer fixo atravessam a superfície e desaparecem abaixo dela. Reações locais reduzem vento, oscilação dos vaga-lumes e intensidade das lanternas existentes; a gata observa a água usando sua lógica e faixa de navegação existentes.

Game Studio: auditoria da água/input/pós-processamento, implementação Three.js/WebGL e assets procedurais locais, métricas da cena completa e playtest por teclado/capturas. A câmera principal, ritual.js, caveiras, geometria do lago e layout não são modificados. A faixa de acesso é necessária porque o raio anterior 1.36 não alcançava o lago.

QA final: 45 verificações, três ciclos completos, ritual → vidência e vidência → ritual, cancelamento antecipado e E rápido; nenhum acúmulo de listeners/objetos/alvos/partículas e console limpo. Viewport 390×844 MEDIUM também passou. Capturas normal geral, água normal e ritual ativo ficaram idênticas pixel a pixel à base.

Cena completa HIGH: normal/retorno 287 calls, 408.680 triângulos, 10 etapas; visão em cache 288/408.680/10; frame com captura 378/613.780/11. Um RT 512² HDR/depth estimado em 3 MiB; comparação 768² 6,75 MiB, sem ganho suficiente na câmera principal. Sem novas luzes; oito partículas adicionais só na experiência. Timer queries não forneceram resultado disponível; testes SwiftShader não estabelecem FPS em GPU física.

## DELUXE 3B — O Jardim Sem Você

A visão anterior foi substituída por uma possibilidade do mesmo Jardim: bruxa ausente, seu chapéu abandonado no centro, gata sentada ao lado e um recesso frio/enevoado dentro do arco existente. Não há figura humanoide, passagem jogável ou narrativa extra.

- `scrying-vision.js`: clona o chapéu original, compartilha seus materiais/geometrias; posa uma cópia da gata e consolida a geometria em quatro batches, uma única vez. A cópia fica em vigília e só respira minimamente, sem outra state machine. Chapéu, gata, contato e recesso estão em layer 12, exclusivo da visão. A gata real permanece na rota aprovada.
- O Jardim usa a mesma cena. Luzes existentes ficam mais frias/fracas somente na captura secundária; cores, intensidades e materiais são restaurados exatamente ao retornar. Não há luz nova nem cópia do cenário.
- `scrying-pond.js`: mantém RT único 512², refresh máximo de 12 Hz e captura sem água/bruxa/gata real, sem recursão. A câmera secundária enquadra círculo e arco; a principal permanece intacta.
- A imagem usa projeção no espaço da câmera para manter proporções legíveis, abismo anterior à revelação, máscara gradual e bordas distorcidas. A abertura do lago passa a 3,60 s, após foco de 1,15 s; fechamento a 2,10 s. Apenas a transformação da vidência foi refinada. Timings do ritual, controles, acesso ao lago e lógica contextual não mudam.
- Exploração normal não renderiza o alvo nem os props da visão. Nada foi modificado em character.js, familiar.js, living-garden.js, main.js, ritual.js, render-pipeline.js, vendor ou caveiras.

Game Studio usado para auditoria anterior, Three.js/WebGL, reutilização de assets procedurais, comparação visual, contagens do jogo completo e playtest. QA: 52 verificações passaram, três ciclos completos, E rápido, cancelamento antecipado, bloqueio de movimento, ritual antes/depois, restauração de valores, RT único e ausência de acúmulo; console sem erros/avisos. Captura normal geral idêntica pixel a pixel à base.

Métricas HIGH: normal/retorno continuam 287 calls / 408.680 triângulos / 10 etapas. Em cache: 288 / 408.680 / 10. A captura secundária submete 103 calls / 213.659 triângulos; o frame com captura totaliza 391 / 622.339 / 11. Antes era 378 / 613.780 / 11. Permanecem 19 luzes, 5.840 instâncias e 14 partículas normais / 22 durante vidência. O RT continua estimado em 3 MiB HDR + depth.

Limitações: a área do lago é pequena na câmera principal, por isso detalhes também são entregues em capturas de inspeção. Folhas aquáticas originais permanecem à frente da janela. Profundidade simulada; QA Chromium/SwiftShader, sem afirmação de FPS de GPU física.

## DELUXE 3B.2 — vidência em toda a superfície

A composição deixa de usar uma janela interna: o shader aplica a visão em todos os fragmentos do topo da geometria original do lago. Não há círculo, retângulo ou máscara localizada limitando a cobertura. O mapping usa os bounds completos projetados no espaço da câmera; a geometria continua sendo o limite orgânico real.

A suavização da margem usa uma DataTexture R8 procedural 96×256 (~24 KiB), calculada uma única vez a partir do contorno original. Ela controla escurecimento/distorção de borda, sem recortar outra forma dentro da água. Nenhuma geometria, UV original, dimensão ou posição do lago foi alterada. A câmera secundária recebeu somente crop moderado (9,2×6,4) para tornar círculo, chapéu, gata e arco maiores. RT único 512² preservado.

Desde E, os valores visuais percorrem uma curva contínua de 2,80 s: foco até 0,55 s, abertura até 2,80 s e visão sustentada. Não há reset de calm/amount/deep/reveal na passagem FOCUS → OPENING. A profundidade escurece primeiro; uma frente líquida irregular parte da margem da bruxa e percorre toda a água. Uma captura antecipada prepara a textura antes de ela ser revelada. Fechamento inverso em 2,10 s, com instabilidade anterior ao retorno de specular/ondas/controle. O material da água não é trocado.

As 24 faixas de ondulação anteriores têm alpha atenuado pelo mesmo uniform de calm no shader do seu material existente. Fora da vidência, o multiplicador é exatamente 1. Vitórias-régias e flores permanecem como geometria real, com depth test e matrizes originais, acima da imagem; não são incorporadas à textura nem ocultadas.

Game Studio: playtest de 52 verificações e três ciclos completos, E rápido, cancelamento antecipado, bloqueio de movimento e ritual antes/depois; console sem erros/avisos. Probe GPU de cobertura encontrou os 126.178 pixels do topo isolado transformados/revelados (100%). As matrizes das 13 vitórias-régias foram iguais antes/durante a visão. Os props e a lógica narrativa da visão não foram alterados.

Contagens da cena completa iguais à versão 3B: normal/retorno 287 calls / 408.680 triângulos / 10 etapas; visão em cache 288 / 408.680 / 10; frame com captura 391 / 622.339 / 11. RT HDR + depth continua aproximadamente 3 MiB; 19 luzes, sem novo passe ou alvo. Há uma leitura extra da pequena textura de margem no shader ativo; a contagem de calls não mede o custo dos fragmentos. Chromium/SwiftShader não estabelece FPS de GPU física.

Entrega inclui sequência na câmera principal (normal, 25/50/75%, aberta, metade do fechamento e retorno), vídeo amostrado a 24 fps e recortes do lago derivados da mesma câmera. A frequência da evidência não representa FPS medido do jogo. Câmera principal, layout, personagem, familiar, ritual, navegação, estados externos e água normal permanecem preservados.

A revisão do vídeo identificou que alternar depthWrite ao entrar/sair do scrying causava um pequeno salto no pós-processamento. A água agora conserva seu depthWrite original durante todo o ciclo. Os oito pontos descendentes se dissipam ao atingir a superfície, mantendo a oclusão física correta. Nenhum material ou buffer de depth é trocado na tecla E.

## DELUXE 3B.3 — posicionamento, leitura e plantas flutuantes

A projeção continua cobrindo todos os fragmentos do topo original, mas usa o centro da faixa exposta na câmera principal (5.45, -0.23, 2.40), escala em view-space e leve shear da metade superior para deixar o arco livre da ponte real. Uma compressão suave das UVs externas evita faixas esticadas por clamp. Contorno, shoreline R8 e geometria do lago permanecem iguais. A câmera secundária enquadra somente círculo/chapéu/gata/arco, com frustum 6,7×6,7, posição (0,4.6,13) e alvo (0,1.05,-0.85). A câmera principal não mudou.

As 13 folhas e 28 pétalas aquáticas existentes recebem submersão analítica no shader, por âncora original. Folhas descem no máximo 0,055 unidade; pétalas 0,30. A própria água opaca as encobre progressivamente; quando totalmente submersas, o shader também descarta esses fragmentos na visão secundária. A curva começa em 0,35 s e termina em 1,65 s da abertura. No fechamento, elas retornam entre 0,85 s e 2,10 s. Matrizes, geometria, materiais e flags de transparência/depth não são trocados. Zero novas instâncias, luzes ou updates por planta.

O contraste é corrigido somente na composição da visão. A iluminação fria temporária da captura foi ajustada e continua restaurada em try/finally. Os props exclusivos da visão têm chapéu em escala 1,45 e gata em 1,48, afastada para x=0,90, preservando contato com o círculo. Um material do pelo é clonado apenas para essa cópia, permitindo separar sua silhueta sem modificar o familiar real. Nenhum novo asset ou estado de IA.

Abertura 2,80 s e fechamento 2,10 s, com curvas suaves contínuas e retorno exato das uniforms ao zero. Mantidos um RT 512², máximo de 12 capturas/s, depthWrite constante, estados existentes, prioridade contextual de E, controles e ritual. Arquivos do runtime alterados: somente scrying-pond.js e scrying-vision.js.

Game Studio: auditoria, Three.js/WebGL, inspeção na câmera normal, QA por teclado, regressão visual e métricas agregadas do frame. Relatório e evidências desta rodada acompanham a entrega; testes em Chromium/WebGL2 SwiftShader não estabelecem FPS de GPU física. A área projetada do lago continua limitada pela câmera/layout aprovados; a projeção é direcionada a essa composição fixa.


## DELUXE 3B.4 — janela viva do próprio Jardim

A auditoria confirmou que a versão 3B.3 já usava `renderer.render(scene, camera)` em um RenderTarget dinâmico. Não existia screenshot importada ou frame congelado. A aparência de imagem colada vinha do enquadramento, das UVs comprimidas/inclinadas e da animação pouco perceptível. A arquitetura foi preservada e a apresentação corrigida dentro do sistema de vidência.

- Projeção linear pelo footprint completo da água original; removidos centro artificial, shear e compressão exponencial das UVs. A própria geometria recorta a superfície, com a shoreline original escurecendo/distorcendo as margens. Nenhum card, textura de screenshot ou imagem externa serve como visão.
- Câmera secundária 7 × 8 unidades, posição base `(3.2, 5.5, 13)`, alvo `(.2, 2.4, -1.4)`, com parallax mínimo contínuo. A câmera principal não mudou.
- Um único RT 512 × 512, atualizado até 20 vezes/s durante a vidência; zero capturas quando o lago está normal. São reaproveitados exatamente a mesma cena, geometria, materiais e uniforms temporais do Jardim. Não há cópia do cenário ou pipeline de pós-processamento secundário.
- Na captura secundária, bruxa/gata reais, água e caveiras são ocultadas temporariamente. O círculo continua original, com chapéu central e cópia da gata em vigília em `(.65, .268, -.10)`. As caveiras reais são restauradas antes de cada render principal e continuam cinco no ritual.
- Movimento discreto da respiração/giro da gata, névoa do arco e intensidade fria temporária reforçam a leitura viva. As animações compartilhadas de vegetação/lanternas continuam usando o tempo do próprio Jardim. Todas as alterações temporárias são restauradas por `try/finally`.
- Mantidas abertura contínua de 2,80 s e saída de 2,10 s, frente líquida irregular, profundidade anterior à revelação, submersão/retorno das 13 folhas e 28 pétalas, depthWrite constante, controles e estados já existentes. Nenhuma troca de material em E.

Game Studio: auditoria Three.js/WebGL, inspeção na câmera principal, QA por teclado com três ciclos completos, regressões e contagens do frame completo. A prova visual adicional lê o RT diretamente com câmera secundária fixa e sem distorção da água; um diagnóstico temporário omite a inscrição original só no sub-render e depois a restaura, demonstrando a origem compartilhada. Esse diagnóstico não integra a versão publicada.

Evidências e métricas completas acompanham a entrega. Contagens são medidas em Chromium/WebGL2 SwiftShader, sem afirmação de FPS em GPU física. A frequência de atualização da captura passou de 12 para 20 Hz, portanto o custo médio durante a visão pode aumentar apesar de o frame de captura submeter menos geometria. Fora da vidência, o custo e os quatro estados de regressão permanecem iguais à base.

Alterados somente `scrying-pond.js`, `scrying-vision.js` e este README. A ponte/margem reais continuam ocultando parte da água, e a leitura em telas pequenas permanece limitada pela área aprovada do lago. Nenhum portal, áudio, Véu, nova visão, mudança de cenário, personagem, familiar real ou ritual foi implementado.


## Deluxe 3B.5 — câmera e projeção da vidência

A visão é renderizada dinamicamente a partir da própria cena. O RenderTarget
existente continua único, com 512 × 512 pixels, HDR e captura limitada a 20 Hz.
Não há screenshot, frame congelado ou card de visão no produto.

O erro anterior vinha de projetar o retângulo completo da malha, incluindo água
encoberta pela ilha e pela ponte. Agora o UV da vidência segue a faixa visível da
água: um levantamento geométrico único de 96 × 128 amostras produz um perfil de
96 linhas, consultado pelo shader. A malha e a posição do lago são as originais.
Os proxies usados nesse cálculo compartilham geometria e nunca entram na cena.
O perfil é um lookup de coordenadas de 1,5 KiB, não uma imagem do Jardim.

A câmera secundária é perspectiva, FOV 36°, posição aproximada (0,25; 5,8; 10),
olhando para (0,25; 0,85; −1,15). O aspect 230/512 corresponde ao recorte útil da
faixa de água. Seu viewport de 230 × 512 fica dentro do mesmo RT de 512 × 512;
o shader lê apenas esse recorte. O viewport é definido no target, sem multiplicar
pelo DPR da tela. O Jardim não é encolhido inteiro: círculo, chapéu e gata são o
primeiro plano, e o arco é o fundo. A deformação acompanha a margem curva.

Os 13 discos e 28 pétalas flutuantes afundam e perdem cobertura progressivamente,
via shader e dither estável, mantendo os batches opacos e seus transforms originais.
Desaparecem até o fim da abertura e voltam na saída. Abertura permanece 2,8 s;
fechamento, 2,1 s; sem trocar material ao apertar E. Estados e input não mudam.
A água é ocultada somente na captura secundária, evitando recursão, e todos os
estados temporários de render são restaurados em finally.

Game Studio / Three.js-WebGL / playtest: três ciclos completos, E rápido,
cancelamento precoce, bloqueio de movimento, retorno à exploração e ritual
antes/depois: 58 verificações passaram, console sem erros/avisos. Só este módulo
e este registro foram alterados; câmera principal, lago, cenário, luzes normais,
personagem, familiar real, ritual, controles e pós-processamento têm bytes iguais.

Métricas no mesmo Chromium WebGL2/SwiftShader, 1536 × 1024, DPR 1,5:

| Frame | Draw calls antes → depois | Triângulos antes → depois | Passes |
|---|---:|---:|---:|
| Exploração normal | 287 → 287 | 408.680 → 408.680 | 10 |
| Visão, RT reutilizado | 288 → 288 | 408.680 → 408.680 | 10 |
| Visão, RT atualizado | 374 → 367 | 591.473 → 588.609 | 11 |

19 luzes, 250 objetos, 5.840 instâncias e 104 materiais permanecem constantes.
RT: aproximadamente 3 MiB com cor HDR e depth, sem alteração. Perfil adicional:
1,5 KiB e duas consultas por fragmento de água ativa, sem novo passe. FPS físico
não foi medido: SwiftShader é software e não representa a GPU do jogador.

Limitações: a faixa visível permanece estreita pela câmera e pelo layout aprovados;
objetos pequenos continuam sujeitos ao tamanho da janela do navegador. O atlas é
específico para a orientação fixa dessa câmera; se ela ou as margens mudarem em
outro bloco, o perfil precisa ser recalculado. Não há novo efeito, nova visão,
portal, Véu, narrativa ou áudio nesta rodada.


## Rodada cirúrgica — vidência proporcional à superfície

A referência visual orienta somente a composição; não é carregada como textura. A visão é renderizada dinamicamente a partir da própria cena, na camada 12, com um único RenderTarget 512×512 a até 20 Hz.

- Removido o remapeamento por linhas, que variava a largura da imagem e deformava a composição. A projeção agora é afim e tem escala constante em toda a superfície.
- Câmera secundária ortográfica na orientação da câmera aprovada, com frustum calculado sobre o contorno real da água. Viewport do target: [0, 52, 512, 408], aspect efetivo 1,255064. Shader, câmera e viewport usam o mesmo recorte, sem esticar o target quadrado.
- Composição 3D específica: meshes reais do círculo e instâncias do arco reaproveitados, grupo com escala uniforme 0,38 nos três eixos. O arco é reposicionado somente na composição da visão para permanecer legível fora da oclusão da ponte. Nenhuma geometria do lago ou do mundo normal foi movida.
- Chapéu repousa no círculo; gata sentada ao lado, com respiração e piscadas; silhueta 3D escura diante da luz fria do arco. Tudo exclusivo da visão. Sem portal jogável ou nova mecânica.
- Iluminação e fog ajustados somente durante a captura, com restauração de cores, intensidades, posições e layers em finally. As mesmas 19 luzes; nenhuma luz adicional. Clones das caveiras compartilham geometria e têm suas luzes removidas.
- Abertura 2,8 s e fechamento 2,1 s preservados. As 41 instâncias flutuantes afundam e perdem cobertura gradualmente, retornando ao estado original.

Game Studio / Three.js / playtest: três ciclos completos, E rápido, cancelamento, movimento bloqueado durante transição, ritual antes/depois e retorno à exploração. Comparação no mesmo relógio: zero pixels diferentes na exploração, margem normal e retorno. Diagnóstico de projeção com discos em duas posições: aproximadamente 21×22 e 21×21 pixels, sem variação de escala entre linhas.

Custo do jogo completo: normal 287 draw calls / 408.680 triângulos; visão com target reutilizado 288 / 408.680; frame com captura nova 326 / 466.575 (antes 367 / 588.609). Captura secundária 38 draw calls / 57.895 triângulos. Passes 10 normal / 11 com captura; target HDR+depth aproximadamente 3 MiB, sem aumento de resolução. FPS físico não medido: QA usa Chromium/SwiftShader e relógio controlado.

Limitação: a água visível tem formato de faixa curva, parcialmente encoberta pela ilha e ponte. A composição ocupa a região útil sem deformar o círculo ou os personagens; as regiões restantes recebem profundidade escura. Não se tenta preencher cada margem esticando o conteúdo. A câmera principal e todos os outros sistemas permanecem intactos.


## Ajuste de composição — arco, vegetação e chapéu

Mantido o RenderTarget único 512×512 e a projeção afim proporcional. Alteração exclusiva da composição da vidência:

- Grupo deslocado de (5,40; −0,35; 2,49) para (5,28; −0,35; 2,79), afastando a composição do píer na câmera normal. Escala uniforme 0,38 preservada; orientação do conjunto ajustada em −0,35 rad para acomodar o arranjo completo na margem curva, sem deformar os objetos.
- Eliminado o deslocamento lateral de +2,7 aplicado somente ao arco. As 49 matrizes das pedras agora correspondem exatamente às instâncias originais do Jardim. Recesso e sombra também retornam ao eixo original do arco.
- Reaproveitadas 3.831 instâncias de grama, folhas, flores, caules e hera, nas posições do cenário real, em 26 batches adicionais. Geometrias compartilhadas, sem duplicar o mapa completo ou adicionar luzes.
- Chapéu centralizado pelo centro da aba. Corrigido o cálculo da altura: a matriz do grupo precisa estar atualizada antes de medir bounds mundiais. O erro anterior enterrava parte do chapéu. Agora o ponto inferior fica na altura local 0,268, sobre o círculo, e o centro da aba coincide com (0; 0,30).
- Luz existente na captura usa a transformação completa do grupo; posições, cores, intensidades e layers são restaurados depois do render. Gata sentada, respiração, piscadas e sombra preservadas.

Game Studio / playtest: 58 verificações funcionais, três ciclos completos, E rápido, cancelamento e ritual antes/depois. Teste geométrico reproduz a falha no baseline e passa após a correção: 49/49 matrizes do arco e 3.831/3.831 da vegetação iguais às originais, contato do chapéu no piso e escala uniforme. Console sem erros ou avisos. Exploração, margem normal e retorno: zero pixels diferentes antes/depois, no mesmo relógio.

Custo do jogo completo: normal permanece 287 draw calls / 408.680 triângulos; visão com captura nova passa de 326 / 466.575 para 352 / 555.471 devido à vegetação. Captura secundária: 64 draw calls / 146.791 triângulos. Mantidos 19 luzes, um target, até 20 capturas/s e aproximadamente 3 MiB de HDR+depth. FPS físico não medido no ambiente SwiftShader. Nenhum estado, controle, ritual, dimensão do lago ou código externo à composição foi alterado.

## Névoa violeta da vidência

As áreas anteriormente pretas recebem bancos de névoa violeta com ruído procedural em três escalas, deriva lenta e variação de densidade. O efeito é composto no passe existente da água, dentro do recorte da própria geometria. A cobertura privilegia o fundo vazio e as margens, preservando o contraste do círculo, chapéu, gata e arco. A névoa acompanha os valores existentes de profundidade/abertura/fechamento; fora da vidência o ramo permanece inativo.

A captura usa iluminação mais sombria e violeta, com redução da contribuição hemisférica e direcional, mantendo a luz focal do círculo. São as mesmas luzes temporariamente ajustadas apenas para a câmera secundária, com restauração exata em finally. Não foram alterados posicionamento, escala, projeção, câmera principal, geometria, estados ou timings.

Game Studio / playtest: 58 verificações passaram, incluindo três ciclos completos, E rápido, cancelamento, bloqueio de movimento, ritual antes/depois e console sem erros ou avisos. Comparação determinística: zero pixels diferentes antes/depois em exploração, margem normal e lago restaurado. Projeção e contagem de recursos idênticas ao baseline.

Custo antes/depois idêntico em draw calls e triângulos: exploração 287 / 408.680; vidência com captura nova 352 / 555.471; captura secundária 64 / 146.791. Permanecem 19 luzes, um RT 512×512 (~3 MiB) e os mesmos objetos/partículas. O shader acrescenta operações de ruído no fragmento da água; tempo de GPU/FPS físico não medido no ambiente SwiftShader. Sem neblina volumétrica, novo passe ou nova luz.

## Refino da névoa — cenário preservado

A máscara baseada em luminosidade foi substituída pela cobertura real do cenário. O mesmo RenderTarget RGBA agora recebe fundo transparente; seu canal alpha identifica círculo, chapéu, gata, vegetação, pedras e portal, inclusive superfícies quase pretas. A névoa principal é aplicada apenas onde essa cobertura está ausente, com proteção adicional das amostras vizinhas. Sem target, textura, passe ou luz adicional. Cor e alpha de limpeza do renderer também são restaurados no finally.

O desenho da névoa usa interpolação quintic, oitavas rotacionadas e deformação em dois eixos. Foi removida a camada esticada de faixas; amplitude, contraste e velocidade foram moderados. A bruma interna da captura passou de densidade 0,015 para 0,008. Iluminação violeta, enquadramento e todos os elementos da visão permanecem nas posições aprovadas.

Game Studio / playtest: 58 verificações passaram, incluindo três ciclos, E rápido, cancelamento, ritual antes/depois e restauração exata da cor/alpha de limpeza. Console sem erros ou avisos. Leitura do target: 31.667 pixels com geometria, 230.473 vazios, quatro parciais; 23.033 pixels cobertos têm luminosidade linear inferior a 0,025 e continuam identificados como cenário. Comparação determinística: zero pixels diferentes na exploração, margem normal e retorno. Projeção, recursos, draw calls, triângulos e memória do RT permanecem iguais ao baseline. FPS físico não medido no ambiente SwiftShader.

## Cabana — lateral fechada / arco com efeito visual

Fechada a lateral visível da cabana, que antes só tinha a fachada. Um painel sólido acompanha a inclinação real do telhado, com 36 peças de alvenaria e duas vigas integradas aos batches existentes. Usados os mesmos materiais/texturas. As adições não consomem o RNG do layout: todas as 5.840 matrizes originais dos batches do mundo permanecem numericamente iguais, com 38 instâncias novas apenas na lateral.

O arco real recebe a mesma superfície azul/violeta, profundidade escura e névoa animada usada dentro da vidência, sem figura. O código do efeito foi extraído para portal-surface.js e é compartilhado pelos dois arcos; cada superfície tem uniforms próprios. É exclusivamente visual: sem passagem, teleporte, nova área, input ou interação. O tempo segue o delta time já existente, sem loop/listener adicional. A sombra permanece somente dentro da vidência.

Game Studio / playtest: 58 verificações passaram, três ciclos de vidência, ritual antes/depois, E rápido, cancelamento, controles e boundaries. Console sem erros ou avisos. Câmera e luzes numericamente iguais; shader do arco real idêntico ao do lago. A leitura completa do RenderTarget no mesmo relógio é byte a byte igual ao baseline após a extração do shader.

Custo normal: 287 → 290 draw calls, 408.680 → 410.857 triângulos. Vidência com captura nova: 352 → 355 calls, 555.471 → 557.648 triângulos. Captura secundária permanece 64 calls / 146.791 triângulos. Duas malhas adicionais, 38 instâncias e um material de shader; mesmas 19 luzes, passes e RT único 512×512 (~3 MiB). FPS físico não medido em SwiftShader. Nenhuma outra melhoria iniciada.


## Deluxe 4 — Véu / projeção astral V1 (07/10/2026)

V entra/sai do Véu. WASD/setas passam a controlar somente a projeção. E mantém
o ritual/vidência no mundo físico e é ignorado no Véu. Entrada e retorno levam
2,1 s; V repetido nas transições é ignorado. Entrada aceita exploração estável,
mas recusa sentar/levantar, ritual e qualquer fase da vidência. O corpo fica
meditando no ponto de entrada; sua pose astral não dispara o ritual.

`veil.js` é o controlador isolado (PHYSICAL → ENTERING → ACTIVE → RETURNING).
A personagem em pé é combinada em um mesh espectral, com material translúcido
Fresnel. A lifeline usa uma ribbon de 40 segmentos; resistência começa em 4,8
unidades e a distância máxima é 6. O movimento horizontal possui amortecimento
e hover de aproximadamente 0,13 unidade, sem voo vertical.

O mesmo Jardim recebe overrides reversíveis de cor/luz/fog, oito wisps de névoa
baixa instanciados, 64 slots de pontos espirituais e emissive seletivo em poucas
plantas. Gata observa a projeção próxima sem segui-la; olhos/aura, caveiras
passivas e o portal existente revelam a camada espiritual. Nenhuma nova luz,
câmera, RenderTarget ou passagem de pós-processamento foi criada.

Arquivos: novo `veil.js`; hooks locais em `character.js`, `main.js`,
`familiar.js`, `living-garden.js`, `portal-surface.js`; documentação e descrição
acessível em `index.html`. Controlador do ritual e arquivos da vidência intactos.

Game Studio / Three.js + playtest: 56 verificações do Véu e 58 de regressão da
vidência/ritual, incluindo três ciclos completos de cada sistema, E/V rápido,
bloqueios de transição, limite/retorno, corpo imóvel e restauração dos materiais,
fog, luzes e câmera. Console sem erros/avisos. Captura física antes/depois
pixel a pixel idêntica no mesmo instante de simulação.

No render HIGH, 290 → 294 draw calls e 410.857 → 425.609 triângulos no Véu.
19 luzes e 10 passes mantidos; 14 → 78 pontos, oito novas instâncias, cinco
objetos de cena adicionais. Físico após retorno: 290 / 410.857 / 14 pontos.
O vídeo foi capturado da aplicação com relógio de QA controlado; seus 15 fps
são taxa de gravação, não benchmark de GPU. FPS de hardware não foi aferido.

Limitações V1: projeção reutiliza pose flutuante fixa; névoa é formada por
billboards leves, não volumetria; limite de exploração usa a ilha e a tether,
sem colisão por triângulo ou navegação de áreas internas. Próximo risco técnico:
validar colisões/oclusão da projeção em conteúdo mais denso e GPU móvel real.
Não foram adicionados inimigos, combate, narrativa, áreas, áudio ou passagem
jogável pelo portal.


## Refinamento do Véu (07/10/2026)

A projeção conserva a superfície vestida, sem efeito de raio X: uma camada
de profundidade compartilha a geometria combinada e oculta as superfícies
internas antes da composição espectral. Continua com a mesma silhueta.

Exploração física: 0,70 → 1,10 unidade/s (+57%). Projeção: 1,10 → 1,65
unidade/s (+50%). Ciclo físico continua baseado na distância percorrida,
com os mesmos controles, transições, limites e ritmo de E/V.

No Véu, projeção e gata compartilham o azul-prateado #9ab2ed. Lanternas,
janela e caveiras recebem esse brilho frio; a intensidade das fontes
existentes foi reaproveitada. A névoa baixa passou de oito para quatorze
instâncias, distribuídas fora dos pontos de leitura principais. Nenhuma
nova luz/RenderTarget foi criada. Fora do Véu, cores normais restauradas.

QA Game Studio: 67 checks do Véu + 58 da vidência/ritual (125), três ciclos
completos de cada sistema, velocidade física/astral, V/E rápido, limites,
retorno e restauração de cores testados. Console sem erros/avisos. Idle
físico pixel a pixel idêntico ao baseline. Véu: 294 → 295 calls e
425.609 → 440.277 triângulos; 19 luzes/10 passes mantidos. O custo extra
vem da leitura de profundidade da mesma geometria, sem outro render da cena.

### Silhueta etérea, bordas e profundidade (07/10/2026)

A projeção ganhou transparência graduada nas bordas e na barra da roupa,
contorno prateado e deriva mínima. A camada de profundidade usa exatamente
o mesmo vertex shader e uniform de tempo para preservar a roupa sobre o
corpo interno durante o movimento. Não foi adicionado outro mesh.

As quatorze névoas foram redistribuídas no perímetro. Noise em três escalas
com domain warp forma wisps baixos; a máscara espacial preserva o centro
do círculo. Onze pontos de energia existentes também ocupam as bordas.

Somente no Véu, o shader do portal ganha quatro recessos em perspectiva,
névoa de planos e centro mais profundo. Nenhuma figura, passagem, luz ou
geometria foi acrescentada. A aparência física do portal permanece igual.

QA Game Studio: 73 verificações do Véu + 58 da vidência/ritual (131), com
três ciclos de cada sistema, restauração, E/V rápido e console limpo.
Capturas físicas antes da entrada e após o retorno idênticas ao baseline.
Véu mantido em 295 calls / 440.277 triângulos / 19 luzes / 10 passes.
O custo adicional se limita ao processamento dos shaders existentes;
FPS de hardware não foi aferido no ambiente de renderização de software.

### Véu vivo: flutuação e espíritos errantes (07/10/2026)

A bruxa astral combina duas frequências de hover e pequenas inclinações
suavizadas de acordo com a velocidade. A lifeline acompanha sua orientação.
A entrada/saída, o corpo físico e a camada que oculta a anatomia interna
continuam preservados. A velocidade máxima permanece em 1,65 unidade/s.

A gata usa os mesmos estados e o mesmo arco seguro. No Véu, sobe gradualmente
até cerca de 25 cm, desacelera/acelera por interpolação e deixa de executar
o ciclo de passos. Corpo, cabeça e cauda têm ritmos independentes. Ao sair,
o apoio físico retorna com a transição; fora do Véu o comportamento original
continua sendo utilizado.

`veil-wanderers.js` acrescenta cinco slots reutilizáveis em um InstancedMesh.
Silhuetas contínuas flutuam por oito corredores curtos, surgem em 1,65 s e
desaparecem em 2,1 s, com substituições sobrepostas. Nenhuma criatura/NPC,
interação, luz, textura externa ou listener novo. O loop só avança no Véu;
ao sair, todos os slots são ocultados/restaurados.

Game Studio: 82 checks de ciclos do Véu, 58 de ritual/vidência e 15 de
flutuação/loop prolongado (155). Três ciclos de cada sistema, controles,
intertravamento e retorno testados. Em 48 s: 2–5 presenças visíveis, média
4,06; rotas validadas contra os triângulos reais da água, cabana, círculo
e limites da ilha. Console sem erros/avisos; nenhum acúmulo de recursos.

Véu: 295 → 296 calls; 440.277 → 444.757 triângulos (+4.480, cerca de 1%).
19 luzes, 10 passes e 64 pontos espectrais mantidos. Só um mesh/material/
geometria novo, cinco instâncias; nenhum RenderTarget adicional. Físico
permanece em 290 calls / 410.857 triângulos e idle inicial idêntico ao
baseline. Limites: corredores curtos autorais, sem pathfinding por planta;
silhuetas procedurais abstratas, sem rig; FPS real de GPU não aferido.

### Projeção articulada e terminação fantasmagórica (07/10/2026)

Os espíritos usam a altura em pé da bruxa (1,6815 unidades), com variação
de apenas ±3%. O corredor da margem foi afastado ligeiramente da água
para acomodar a silhueta maior. Quantidade, pool e comportamento mantidos.

A projeção exclui pernas/botas somente da geometria astral. Uma cauda
afunilada e dois fios curvos ocupam a parte inferior, com movimento suave
que acompanha o deslocamento. Ombros, cotovelos, cabeça, coluna, cabelo e
capa recebem movimentos independentes no vertex shader. A máscara de
profundidade usa a mesma deformação, preservando a roupa sem expor volumes
internos. O hover de 0,38 unidade mantém os fios acima do piso do círculo.
O corpo físico e suas botas permanecem intactos.

Game Studio: 91 verificações do Véu, 58 de ritual/vidência e 16 do loop
prolongado (165). Três ciclos de cada sistema, teclas rápidas, limites,
retorno, navegação segura e console limpo. Captura física inicial idêntica
ao baseline. Vídeo geral na câmera aprovada e close separado de movimento.

Nesta rodada: Véu 296 calls mantidos; 444.757 → 444.885 triângulos (+128).
Físico 290 calls / 410.857 triângulos; 19 luzes / 10 passes mantidos.
Sem novo mesh, luz, listener ou RenderTarget. A deformação aumenta o
trabalho por vértice; FPS real de hardware não foi medido. Animação
procedural simplificada, sem rig humanoide novo.

### Cauda astral única e fluida (07/10/2026)

Removidos os dois fios laterais da projeção. Apenas a cauda central permanece,
com onda progressiva em dois eixos, frequências diferentes e amplitude maior
na ponta. A base continua presa à roupa; a cauda ondula mesmo em repouso e
responde ao deslocamento. Cor e máscara de profundidade usam a mesma
deformação. Corpo físico, espíritos errantes e demais sistemas preservados.

Validação pontual com Game Studio: comparação antes/depois, vídeo em repouso,
três ciclos do Véu, V rápido, movimento, retorno, ritual e console. A remoção
reduz a geometria astral sem acrescentar meshes, luzes ou passes.
