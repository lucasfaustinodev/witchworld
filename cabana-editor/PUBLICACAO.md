# Witch World — jogo principal e cabana aprovada

URL: https://witchworld.vercel.app/

A página principal carrega o jogo completo do Jardim v44. A tecla E na porta entra na cabana atualizada; E na passagem interna retorna ao Jardim. O mesmo personagem, navegação contextual, renderer e composer continuam ativos. O editor de composição não é publicado como entrada do jogo.

A composição, materiais e assets da cabana usam a versão 14 aprovada do laboratório, incluindo as 149 entradas de layout, cópias e exclusões, lençol, banners, luminárias, poção e tapete atualizado. O módulo de gameplay reutiliza os construtores Three.js já existentes; não carrega React, Zustand, controles de edição ou um loop de render adicional.

Fonte do jogo: preview Jardim v44, commit 723ce1810be10840749d89378c08d634de021065. Fonte da cabana: laboratório versão 14, commit d72d1713f4dd8095f54710380c51b8a3967cc8f5. Os módulos do Jardim permanecem iguais à v44; cabin-interior.js é o adaptador compilado da composição aprovada.

build:publish verifica o código e compila apenas cabin-interior.js para o dist principal; não executa o build da interface do editor sobre o game. O editor continua sendo ferramenta de autoria no laboratório.

Validação: testes originais da cabana, TypeScript, build, Rapier real, caminhada no piso, entrada/saída em três ciclos e ausência de editor/renderer/listeners adicionais. Testes de geometria headless removem apenas mapas dos GLBs para carregar os modelos no Node; o runtime real carrega os GLBs originais completos. Renderização WebGL e aparência final desta integração ainda precisam de QA visual.
