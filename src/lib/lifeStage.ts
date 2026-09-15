export const LIFE_STAGES = ['All', 'Cachorro', 'Adulto', 'Senior'] as const;

export type LifeStage = (typeof LIFE_STAGES)[number];

export const LIFE_STAGE_DEFAULT: LifeStage = 'All';

export interface LifeStageOption {
  value: LifeStage;
  label: string;
}

export const LIFE_STAGE_OPTIONS: LifeStageOption[] = [
  { value: 'All', label: 'Todas las Etapas' },
  { value: 'Cachorro', label: 'Cachorro' },
  { value: 'Adulto', label: 'Adulto' },
  { value: 'Senior', label: 'Senior' },
];

/**
 * Devuelve `true` cuando el valor representa "todas las etapas".
 * Acepta tanto el valor canónico del backend (`All`) como variantes
 * históricas en minúscula, para no romper datos ya existentes.
 */
export const isAllLifeStage = (lifeStage?: string | null): boolean =>
  !lifeStage || lifeStage.toLowerCase() === 'all';
