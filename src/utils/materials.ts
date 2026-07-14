// Tabela de materiais e preços por unidade
export interface Material {
  label: string;       // Nome exibido no menu
  value: string;       // ID interno do material
  emoji: string;       // Emoji decorativo
  pricePerUnit: number; // Preço em reais por unidade
}

export const MATERIALS: Material[] = [
  {
    label: 'Tronco de Madeira',
    value: 'tronco_madeira',
    emoji: '🪵',
    pricePerUnit: 0.20,
  },
  // Para adicionar novos materiais futuramente, basta adicionar um novo objeto aqui:
  // {
  //   label: 'Pedra',
  //   value: 'pedra',
  //   emoji: '🪨',
  //   pricePerUnit: 0.10,
  // },
];

export function getMaterialByValue(value: string): Material | undefined {
  return MATERIALS.find(m => m.value === value);
}

export function calculateValue(materialValue: string, quantity: number): number {
  const material = getMaterialByValue(materialValue);
  if (!material) return 0;
  return parseFloat((material.pricePerUnit * quantity).toFixed(2));
}
