export function buildActivationChecklist(state) {
  const steps = [
    { id: 'company', label: 'Completar dados da empresa', tab: 'configuracoes', complete: state.hasCompanyDetails === true, optional: false },
    { id: 'inventory', label: 'Cadastrar o primeiro item do acervo', tab: 'acervo', complete: Number(state.inventoryCount) > 0, optional: false },
    { id: 'team', label: 'Convidar alguém da equipe', tab: 'equipe', complete: Number(state.memberCount) > 1 || Number(state.invitationCount) > 0, optional: false },
    { id: 'proposal', label: 'Criar a primeira proposta', tab: 'propostas', complete: Number(state.proposalCount) > 0, optional: false },
    { id: 'whatsapp', label: 'Conectar o WhatsApp beta', tab: 'configuracoes', complete: state.whatsappConnected === true, optional: true },
  ];
  const required = steps.filter((step) => !step.optional);
  return {
    steps,
    completedRequired: required.filter((step) => step.complete).length,
    requiredTotal: required.length,
  };
}
