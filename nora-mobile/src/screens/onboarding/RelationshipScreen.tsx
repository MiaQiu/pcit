/**
 * Relationship Screen
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { MultipleChoiceScreen } from '../../components/MultipleChoiceScreen';
import { useOnboarding } from '../../contexts/OnboardingContext';

export const RelationshipScreen: React.FC = () => {
  const { data } = useOnboarding();
  const { t } = useTranslation();
  const userName = data.name || 'there';

  return (
    <MultipleChoiceScreen
      headerText={t('onboarding.relationship.headerText')}
      title={t('onboarding.relationship.title', { name: userName })}
      options={[
        { value: 'MOTHER', label: t('onboarding.relationship.mother') },
        { value: 'FATHER', label: t('onboarding.relationship.father') },
        { value: 'GRANDMOTHER', label: t('onboarding.relationship.grandmother') },
        { value: 'GRANDFATHER', label: t('onboarding.relationship.grandfather') },
        { value: 'OTHER', label: t('onboarding.relationship.other') },
      ]}
      dataField="relationshipToChild"
      nextScreen="ChildName"
      prevScreen="NameInput"
      phase={1}
      stepInPhase={2}
      totalStepsInPhase={6}
      screenName="relationship"
      screenStep={13}
    />
  );
};
