// Portuguese (Portugal — pt-PT) UI strings. Translated from en.ts.
//
// Conventions for this file:
//   - Casual "tu" form throughout (matches Stridekeep's wholesome
//     mobile-game vibe; "você" reads as distant for this audience).
//   - PT-PT vocabulary, NOT PT-BR — when in doubt, prefer the form
//     used in Portugal (e.g., "écran" not "tela", "telemóvel" not
//     "celular", "carregar" not "baixar").
//   - VALUES preserve the CASING of the English source — uppercase
//     'CONTINUE' → uppercase 'CONTINUAR' — so the call sites that
//     rely on visual weight (button labels, kickers) stay consistent.
//   - Variable interpolation tokens are IDENTICAL to en.ts — `{n}`
//     stays `{n}`. The resolver does string replace by token name,
//     so changing the token name here would silently break the value.
//
// Adding a key: ALWAYS add to en.ts first (it's the canonical
// source). The TKey constraint below will trigger a TypeScript
// compile error if a key exists in en.ts but is missing from this
// file — that's the safety net for partial translations.

import type { TKey } from './en';

export const pt: Record<TKey, string> = {
  // Affordances genéricos da UI — botões, modais, descartes.
  'common.continue': 'CONTINUAR',
  'common.skip': 'SALTAR →',
  'common.cancel': 'CANCELAR',
  'common.close': 'FECHAR',
  'common.save': 'GUARDAR',
  'common.confirm': 'CONFIRMAR',
  'common.back': 'VOLTAR',
  'common.delete': 'ELIMINAR',
  'common.done': 'CONCLUÍDO',
  'common.next': 'SEGUINTE',
  'common.ok': 'OK',
  'common.retry': 'TENTAR DE NOVO',
  'common.loading': 'A carregar…',

  // Barra de separadores inferior.
  'tabs.home': 'INÍCIO',
  'tabs.inventory': 'INVENTÁRIO',
  'tabs.shop': 'LOJA',

  // Sub-separadores do Início.
  'subtabs.mural': 'Mural',
  'subtabs.cases': 'Caixas',
  'subtabs.profile': 'Perfil',

  // SeasonCard.
  'season.day': 'DIA {n}',
  'season.extended': 'PROLONGADO · PRÓXIMO MURAL PENDENTE',
  'season.steps': 'PASSOS',
  'season.purse': 'CARTEIRA',
  'season.awaitingFirstPixel': 'À ESPERA DO PRIMEIRO PIXEL',
  'season.tied': 'EMPATE',
  'season.leadRed': 'LIDERA: VERMELHO +{n}',
  'season.leadBlue': 'LIDERA: AZUL +{n}',
  'season.redSide': 'VERMELHO {n}',
  'season.blueSide': '{n} AZUL',

  // CasesPanel + CaseCard.
  'case.materialsKicker': 'MATERIAIS',
  'case.open': 'ABRIR',
  'case.pending': '{n} POR ABRIR',
  'case.stepsLeft': 'FALTAM {n}',

  // CanvasPanel.
  'canvas.yourTeam': 'A TUA EQUIPA',
  'canvas.enemyTeam': 'EQUIPA ADVERSÁRIA',
  'canvas.swipeToSeeOpponent': '  ·  desliza para ver o adversário',
  'canvas.swipeToReturn': '  ·  desliza para voltar',
  'canvas.tilesUnit': 'TILES',
  'canvas.percentFilled': '{n}% PREENCHIDO',
  'canvas.liveFeedTitle': 'ACÇÕES EM DIRETO',
  'canvas.noActivityYet': 'Sem atividade ainda.',
  'canvas.awaitingNextSeason': 'A aguardar pela próxima temporada…',
  'canvas.loadingCanvas': 'A carregar o mural…',
  'canvas.placeFailedTitle': 'Não foi possível colocar o tile',

  // TilePicker.
  'tilePicker.title': 'COLOCAR TILE',
  'tilePicker.youHave': 'Tens',
  'tilePicker.commit': 'COLOCAR',
  'tilePicker.noStock': 'Não tens tiles desta cor no inventário.',
  'tilePicker.getMore': 'Abre caixas para ganhares mais.',

  // ProfilePanel.
  'profile.lifetime': 'TODOS OS TEMPOS',
  'profile.lifetimeSteps': 'PASSOS',
  'profile.tilesPlaced': 'TILES COLOCADOS',
  'profile.casesOpened': 'CAIXAS ABERTAS',
  'profile.starter': 'INICIAL',
  'profile.quality': 'QUALIDADE',
  'profile.fine': 'FINA',
  'profile.muralsSection': 'MURAIS · {n}',
  'profile.muralsEmpty':
    'Ainda sem murais — ganha uma temporada para conquistares o primeiro.',
  'profile.bestSeason': 'MELHOR TEMPORADA',
  'profile.bestSeasonEmpty':
    'A primeira temporada concluída fica registada aqui.',
  'profile.seasonNumber': 'TEMPORADA {n}',
  'profile.peakContribution': 'A tua melhor contribuição',
  'profile.pixelSingular': 'PIXEL',
  'profile.pixelPlural': 'PIXELS',

  // ShopScreen.
  'shop.title': 'LOJA',
  'shop.empty': 'Sem cores na loja esta temporada — volta na próxima.',
  'shop.buy': 'COMPRAR',
  'shop.notEnoughPurse': 'Não tens carteira suficiente.',

  // InventoryScreen.
  'inventory.title': 'INVENTÁRIO',
  'inventory.colors': 'Cores',
  'inventory.mixing': 'Mistura',
  'inventory.empty':
    'Abre caixas para ganhares tiles. Aparecem aqui para os colocares no mural.',

  // ColorsPanel.
  'colors.kicker': 'CORES DE PIXEL',
  'colors.loadingPalette': 'A carregar a paleta desta temporada…',
  'colors.muralPrepHint':
    'A ferramenta de preparação semeia as cores no início da temporada.',
  'colors.noColors': 'Sem cores na paleta desta temporada.',
  'colors.placeOnCanvas': 'COLOCAR NO MURAL',
  'colors.sell': 'VENDER',
  'colors.sellOne': 'VENDER 1',
  'colors.youOwn': 'Tens',
  'colors.outOfStock': 'Sem tiles no inventário.',

  // MixingPanel.
  'mixing.recipesHeader': 'RECEITAS',
  'mixing.craftWithHeader': 'CRIAR COM',
  'mixing.loading': 'A carregar receitas…',
  'mixing.noRecipesForColor': 'Sem receitas que usem esta cor.',
  'mixing.noRecipesThisSeason': 'Sem receitas de mistura esta temporada.',
  'mixing.needOneMore': 'FALTA 1 INGREDIENTE',
  'mixing.needNMore': 'FALTAM {n} INGREDIENTES',
  'mixing.craft': 'CRIAR',

  // ColorDetailSheet.
  'detail.youHave1Tile': 'Tens 1 tile',
  'detail.youHaveTiles': 'Tens {n} tiles',
  'detail.notInInventory': 'Não está no inventário',
  'detail.obtainShopOnly': 'SÓ NA LOJA',
  'detail.obtainShopOnlyPriced': 'SÓ NA LOJA · {price}',
  'detail.obtainCrafted': 'CRIADA · Vê a tab MISTURA para a receita',
  'detail.obtainDropsFrom': 'SAI EM {case}',
  'detail.obtainCaseDrop': 'SAI EM CAIXAS',
  'detail.actionBuyOne': 'COMPRAR 1 · {price}',
  'detail.actionSellOne': 'VENDER 1 · {price}',
  'detail.actionPlace': 'COLOCAR NO MURAL',
  'detail.actionCraftWith': 'CRIAR COM ESTA',

  // Cerimónia de fim de temporada.
  'ceremony.headline.win': 'A TUA EQUIPA GANHOU',
  'ceremony.headline.loss': 'PARA A PRÓXIMA',
  'ceremony.headline.tie': 'EMPATE',
  'ceremony.subhead.win': 'Temporada {n} — pintaste na história',
  'ceremony.subhead.loss':
    'Temporada {n} — continua a andar, o próximo mural espera-te',
  'ceremony.subhead.tie': 'Ambas as equipas vão lembrar-se desta',
  'ceremony.seasonTag': 'TEMPORADA {n}',
  'ceremony.youPlaced': 'COLOCASTE',
  'ceremony.pixelSingular': 'PIXEL',
  'ceremony.pixelPlural': 'PIXELS',
  'ceremony.badgeEarned': 'INSÍGNIA GANHA',
  'ceremony.badgeSeasonLine': 'Temporada {n}',
  'ceremony.nextUp': 'A SEGUIR →',
  'ceremony.nextSeasonNum': 'TEMPORADA {n}',
  'ceremony.untitled': 'Sem título',
  'ceremony.nextMuralComingSoon': 'Próximo mural em breve',

  // Tutorial de boas-vindas (modal de 2 cartões na primeira abertura).
  'onboarding.stepOf': 'PASSO {n} DE {total}',
  'onboarding.skip': 'SALTAR',
  'onboarding.next': 'SEGUINTE',
  'onboarding.gotIt': 'PERCEBI',
  'onboarding.card1.title': 'ANDAR É TUDO',
  'onboarding.card1.body':
    'Os teus passos no mundo real são o teu único recurso. Sem compras, sem atalhos — cada jogada começa com um passo.',
  'onboarding.card2.title': 'O CICLO',
  'onboarding.card2.body':
    'Anda para encheres caixas. Abre caixas para teres pixeis coloridos. Coloca pixeis para pintares o mural da tua equipa.',

  // JIT tutorial — primeira caixa.
  'jit.skip': 'SALTAR TUTORIAL',
  'jit.firstCase.step0.title': 'A TUA PRIMEIRA CAIXA ESTÁ PRONTA',
  'jit.firstCase.step0.body':
    'Toca em Caixas para veres o que os teus passos desbloquearam.',
  'jit.firstCase.step1.title': 'ABRE-A',
  'jit.firstCase.step1.body': 'Toca em ABRIR para reclamares o teu pixel.',
  'jit.firstCase.step2.title': 'O TEU PIXEL ESTÁ NO INVENTÁRIO',
  'jit.firstCase.step2.body':
    'Toca em INVENTÁRIO na parte de baixo para o encontrares.',
  'jit.firstCase.step3.title': 'ALI ESTÁ',
  'jit.firstCase.step3.body': 'Toca no teu novo pixel para veres as ações.',
  'jit.firstCase.step4.title': 'COLOCA-O NO MURAL',
  'jit.firstCase.step4.body':
    'Toca em COLOCAR NO MURAL para o enviares para casa.',

  // Erros de colocação.
  'place.pixelTaken': 'Foste apanhado!',
  'place.wrongColorWithName': 'Esse pixel precisa de {name}.',
  'place.wrongColor': 'Esse pixel precisa de uma cor diferente.',
  'place.canvasComplete': 'Mural completo — a temporada acabou de terminar.',
  'place.seasonMismatch': 'A temporada mudou — a atualizar.',
  'place.notOwned': 'Não tens esta cor.',
  'place.notAuthenticated': 'Sessão não iniciada.',
  'place.networkError': 'Erro de rede — tenta de novo.',
  'place.unknown': 'O servidor devolveu uma resposta desconhecida. Atualiza a app.',

  // NicknameOnboardingModal.
  'nickname.title': 'ESCOLHE UMA ALCUNHA',
  'nickname.body':
    'É assim que outros jogadores te veem nos passos em direto. Podes mudar a qualquer altura nas Definições.',
  'nickname.placeholder': 'ex. Pixelwalker',
  'nickname.tooShort': 'Pelo menos 2 caracteres.',
  'nickname.tooLong': 'No máximo 20 caracteres.',
  'nickname.taken': 'Já está em uso. Tenta outra.',
  'nickname.save': 'CONTINUAR',

  // TopHeader.
  'header.seasonSubtitleWithName': 'Temporada {n} · {name}',
  'header.seasonSubtitleNoName': 'Temporada {n}',

  // Definições — drill-in row labels.
  'settings.title': '⚙  DEFINIÇÕES',
  'settings.account': 'Conta',
  'settings.privacy': 'Privacidade',
  'settings.notifications': 'Notificações',
  'settings.sound': 'Som',
  'settings.language': 'Idioma',
  'settings.currency': 'Moeda',
  'settings.about': 'Sobre',
  'settings.linked': 'Associada',
  'settings.anonymous': 'Anónima',

  // Cabeçalhos das secções.
  'settings.section.account': 'CONTA',
  'settings.section.privacy': 'PRIVACIDADE',
  'settings.section.notifications': 'NOTIFICAÇÕES',
  'settings.section.sound': 'SOM',
  'settings.section.language': 'IDIOMA',
  'settings.section.currency': 'MOEDA',
  'settings.section.about': 'SOBRE',

  // Idioma.
  'language.kicker': 'IDIOMA',
  'language.body':
    'Escolhe o idioma que o Stridekeep usa para botões, menus e tutorial. Os nomes das cores e outras etiquetas atmosféricas mantêm-se iguais em todos os idiomas.',
  'language.option.en': 'English',
  'language.option.pt': 'Português',
  'language.detected':
    'Detetado automaticamente do teu dispositivo. Podes mudar a qualquer altura.',

  // Secção Moeda.
  'currency.kicker': 'MOEDA',
  'currency.body':
    'A carteira do Stridekeep é uma moeda fantasia — escolhe o símbolo que te parece mais natural. A formatação dos números continua a respeitar o teu dispositivo.',
  'currency.option.auto': 'Detetar automaticamente ({code})',
  'currency.option.eur': 'Euro (€)',
  'currency.option.usd': 'Dólar Americano ($)',
  'currency.option.gbp': 'Libra Esterlina (£)',
  'currency.note':
    'Dica: se "Detetar automaticamente" mostrar a moeda errada, é provável que o teu Android esteja configurado para outra região — escolhe aqui uma moeda específica para forçar.',

  // Secção Conta.
  'account.kicker': 'CONTA',
  'account.bodyAnon':
    'O Stridekeep funciona sem conta — o teu progresso fica ligado a este dispositivo. Associa um email ou conta Google para recuperares o progresso noutro dispositivo.',
  'account.bodyLinked':
    'O teu progresso está associado a este email. Termina a sessão para mudares de conta neste dispositivo.',
  'account.linkEmail': 'ASSOCIAR COM EMAIL',
  'account.linkGoogle': 'ASSOCIAR COM GOOGLE',
  'account.signOut': 'TERMINAR SESSÃO',
  'account.signIn': 'INICIAR SESSÃO',
  'account.emailPlaceholder': 'Email',
  'account.passwordPlaceholder': 'Palavra-passe',
  'account.statusLinked': 'Associada a {email}',
  'account.statusAnon': 'Anónima · só neste dispositivo',

  // Secção Privacidade.
  'privacy.kicker': 'POLÍTICA',
  'privacy.body':
    'Recolhemos os teus passos via Health Connect, a tua equipa e colocações, e a alcunha que escolheste. Lê a política completa ou pede a eliminação dos teus dados abaixo.',
  'privacy.termsLink': 'TERMOS DE UTILIZAÇÃO',
  'privacy.policyLink': 'POLÍTICA DE PRIVACIDADE',
  'privacy.emailTeam': 'CONTACTAR A EQUIPA DE PRIVACIDADE',
  'privacy.emailTeamSub': 'Dúvidas, apoio ou eliminação por email',
  'privacy.openInBrowser': 'Abrir no navegador',
  'privacy.comingSoon': 'Em breve',
  'privacy.deleteAccount': 'ELIMINAR A MINHA CONTA',
  'privacy.deleting': 'A ELIMINAR…',
  'privacy.deleteAccountSub': 'Remover todos os meus dados permanentemente',
  // Diálogos de confirmação em dois passos.
  'privacy.deleteConfirmTitle': 'Eliminar a tua conta?',
  'privacy.deleteConfirmBody':
    'Isto remove permanentemente a tua equipa, insígnias, estatísticas e conta dos nossos servidores. As tuas colocações no mural permanecem mas tornam-se anónimas. Não pode ser desfeito.',
  'privacy.cancel': 'Cancelar',
  'privacy.deleteConfirmContinue': 'Continuar',
  'privacy.deleteConfirm2Title': 'Tens a certeza absoluta?',
  'privacy.deleteConfirm2Body':
    'Não há recuperação. Vais começar de novo como um jogador anónimo.',
  'privacy.deleteConfirm2Action': 'Eliminar para sempre',
  // Caminhos de falha.
  'privacy.errorNotAuth':
    'Não tens sessão iniciada. Reinicia a app e tenta de novo.',
  'privacy.errorNetwork':
    'Erro de rede. Verifica a tua ligação e tenta de novo.',
  'privacy.errorGeneric':
    'Não foi possível eliminar a tua conta. Tenta de novo ou envia um email para {email}.',
  'privacy.errorOpenLink':
    'Não foi possível abrir {label}. Tenta de novo.',
  'privacy.errorOpenMail':
    'Não foi possível abrir a tua app de email. Envia um email directo para {email}.',
  'privacy.linkLabelPolicy': 'a política de privacidade',
  'privacy.linkLabelTerms': 'os termos de utilização',
  // Diálogo de sucesso após eliminação.
  'privacy.deletedTitle': 'Conta eliminada',
  'privacy.deletedBody':
    'A tua conta e todos os dados associados foram removidos. És agora um jogador anónimo novo — escolhe uma alcunha para começar de novo.',
  // Email pré-preenchido (assunto + corpo interpolam o UUID do jogador).
  'privacy.mailSubject': 'Stridekeep apoio — jogador {uid}',
  'privacy.mailBody':
    'Olá equipa Stridekeep,\n\nO meu ID de jogador é {uid}.\n\n(Descreve aqui a tua dúvida ou pedido.)',

  // Secção Notificações.
  'notifications.kicker': 'NOTIFICAÇÕES',
  'notifications.body':
    'Escolhe que tipo de avisos queres quando chegarem notificações push.',
  'notifications.dailyWalkReminderLabel': 'Lembrete diário para andar',
  'notifications.dailyWalkReminderSub':
    'Um empurrão se ainda não te mexeste muito ao final do dia.',
  'notifications.seasonEndingSoonLabel': 'Temporada a terminar',
  'notifications.seasonEndingSoonSub':
    'Aviso no dia antes de uma temporada fechar.',
  'notifications.teamActivityLabel': 'Colega coloca na tua cor',
  'notifications.teamActivitySub':
    'Quando alguém preenche um pixel de uma cor que já colocaste.',
  'notifications.fineprint':
    'As notificações push chegam numa atualização futura — as tuas preferências ficam guardadas.',

  // Secção Som.
  'sound.kicker': 'SOM',
  'sound.body':
    'Interruptores independentes para os efeitos sonoros e para a música ambiente em loop.',
  'sound.sfxLabel': 'Sons do jogo',
  'sound.sfxSub':
    'Abrir caixas, colocar tiles, celebração da temporada, aviso de recusa.',
  'sound.musicLabel': 'Música ambiente',
  'sound.musicSub':
    'Loop ambiente que toca enquanto estás na app. Pausa quando mudas para outra app.',
  'sound.silentSwitchNote':
    'Respeita o interruptor silencioso do iOS — colocar o telemóvel em silêncio cala o Stridekeep mesmo com estes interruptores ligados.',

  // Gate do Health Connect (modal bloqueante na raiz da App quando o
  // dispositivo precisa de instalar o Health Connect ou não consegue
  // executá-lo). Só aparece em telemóveis onde o jogador ainda não
  // instalou a app do sistema HC, ou em dispositivos pré-Android 8.
  'healthConnect.needsInstallKicker': 'FALTA UM PASSO',
  'healthConnect.needsInstallTitle': 'Instala o Health Connect',
  'healthConnect.needsInstallBody':
    'O Stridekeep lê os teus passos diários através do Health Connect — uma app gratuita da Google que mantém os dados dos teus passos no telemóvel. Toca abaixo para a instalar a partir da Play Store; volta ao Stridekeep depois de a instalares.',
  'healthConnect.needsInstallCta': 'INSTALAR HEALTH CONNECT',
  'healthConnect.unsupportedKicker': 'DISPOSITIVO NÃO SUPORTADO',
  'healthConnect.unsupportedTitle': 'Este dispositivo não suporta o Health Connect',
  'healthConnect.unsupportedBody':
    'O Stridekeep precisa do Health Connect para contar os teus passos, e o Health Connect exige Android 8 ou superior. Desculpa — não há nada que possamos fazer neste dispositivo.',

  // Secção Sobre.
  'about.kicker': 'STRIDEKEEP',
  'about.body':
    'Um jogo de caminhada em equipa onde cada passo pinta um mural partilhado.',
  'about.versionLabel': 'VERSÃO',
  'about.buildLabel': 'BUILD',
  'about.credits': 'Feito com carinho pelo Wynter.',
};
