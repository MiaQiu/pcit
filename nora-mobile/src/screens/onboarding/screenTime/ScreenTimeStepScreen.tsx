/**
 * Screen-Time Step Screen
 * Renders one step of the screen-time onboarding branch (see screenTimeFlow.ts):
 * questions through MultipleChoiceScreen, insight screens in the
 * ParentGoalIntro text style, and the closing plan, which saves the answers
 * and finishes onboarding.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useTranslation, Trans } from 'react-i18next';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { MultipleChoiceScreen } from '../../../components/MultipleChoiceScreen';
import { OnboardingProgressHeader } from '../../../components/OnboardingProgressHeader';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import { useAuthService } from '../../../contexts/AppContext';
import amplitudeService from '../../../services/amplitudeService';
import {
  OnboardingStackParamList,
  OnboardingStackNavigationProp,
  RootStackNavigationProp,
} from '../../../navigation/types';
import {
  SCREEN_TIME_STEPS,
  ScreenTimeQuestionStep,
  ScreenTimeInsightStep,
  buildScreenTimeIntake,
  DEV_SAMPLE_ANSWERS,
  childAgeYears,
  genderContext,
  screenTimePath,
  adjacentStepIndex,
} from './screenTimeFlow';
import { ScreenTimeScene } from './ScreenTimeScene';
import { OnboardingFooter } from '../../../components/OnboardingFooter';

const NS = 'onboarding.screenTime';
// Horizontal padding of insight/plan content (styles.scrollContent)
const CONTENT_PADDING = 32;
// Advisor card width as a share of the content width
const ADVISOR_WIDTH_RATIO = 1.2; // >1 extends into the page padding
// Amplitude funnel step numbers for this branch start here, clear of the main flow's
const ANALYTICS_STEP_BASE = 100;

// Text uses the Nora-Onboarding-1 prototype's fonts (Outfit titles, DM Sans body),
// sized up for the app; layout and colors are the app's onboarding style.
// Insight steps whose title is a full sentence get the smaller title size.
const LONG_TITLE_STEPS = new Set(['transition', 'routine']);

// A block renders one or more strings; several keys in one callout share a single box.
type Block = { kind: 'p' | 'callout'; key: string | string[] };

// Body of each insight screen, in order. Strings may use <hl> (purple) and <b> tags.
const INSIGHT_BLOCKS: Record<string, Block[]> = {
  intro: [{ kind: 'p', key: 'p1' }, { kind: 'p', key: 'p2' }, { kind: 'p', key: 'p3' }, { kind: 'p', key: 'p4' }],
  // context.p2 ("When the stimulation suddenly stops…") is hidden; its copy stays in the locales
  context: [{ kind: 'p', key: 'lead' }, { kind: 'p', key: 'p1' }, { kind: 'callout', key: ['callout1', 'callout2'] }],
  // why: copy by path (see screenTimePath); both versions share this layout
  why: [{ kind: 'p', key: 'p1' }, { kind: 'p', key: 'p2' }, { kind: 'callout', key: 'callout1' }, { kind: 'p', key: 'p3' }],
  cortexHelp: [{ kind: 'p', key: 'p1' }, { kind: 'p', key: 'p2' }],
  canLearn: [{ kind: 'p', key: 'p1' }, { kind: 'callout', key: 'callout1' }],
  easierEnd: [{ kind: 'p', key: 'p1' }, { kind: 'callout', key: 'callout1' }],
  windows: [{ kind: 'p', key: 'p1' }, { kind: 'p', key: 'p2' }, { kind: 'callout', key: 'callout1' }],
  practice: [{ kind: 'p', key: 'p1' }, { kind: 'callout', key: 'callout1' }],
  transition: [{ kind: 'callout', key: 'callout1' }],
  play: [{ kind: 'p', key: 'p1' }, { kind: 'callout', key: 'callout1' }, { kind: 'p', key: 'p2' }],
  nora: [],
  routine: [{ kind: 'callout', key: 'callout1' }],
  specialPlay: [{ kind: 'p', key: 'p1' }, { kind: 'callout', key: 'callout1' }],
  // byPath steps can lay out each path differently, keyed `<id>.<path>`
  'coaching.differences': [{ kind: 'p', key: 'p1' }],
  'coaching.none': [{ kind: 'p', key: 'p1' }, { kind: 'callout', key: 'callout1' }],
};

const RichText: React.FC<{ i18nKey: string; style: any; values: Record<string, unknown>; context?: string }> = ({
  i18nKey,
  style,
  values,
  context,
}) => (
  <Text style={style}>
    <Trans
      i18nKey={i18nKey}
      values={values}
      context={context}
      components={{ hl: <Text style={styles.highlight} />, b: <Text style={styles.bold} /> }}
    />
  </Text>
);

export const ScreenTimeStepScreen: React.FC = () => {
  const route = useRoute<RouteProp<OnboardingStackParamList, 'ScreenTimeStep'>>();
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data, updateData } = useOnboarding();

  // DEV ONLY: sample answers (and a gender) for a dev force-landing, e.g. straight onto the plan
  useEffect(() => {
    if (!__DEV__ || !route.params?.devSample) return;
    if (!data.screenTime || Object.keys(data.screenTime).length === 0) updateData({ screenTime: DEV_SAMPLE_ANSWERS });
    if (!data.childGender) updateData({ childGender: 'BOY' });
  }, []);

  const index =
    route.params?.step ?? Math.max(0, SCREEN_TIME_STEPS.findIndex((s) => s.id === route.params?.stepId));
  const step = SCREEN_TIME_STEPS[index];
  const screenName = `screen_time_${step.id}`;
  const analyticsStep = ANALYTICS_STEP_BASE + index;

  const values = { name: data.childName || '' };
  const context = genderContext(data.childGender);

  useEffect(() => {
    // MultipleChoiceScreen tracks its own views
    if (step.kind !== 'question') amplitudeService.trackOnboardingScreen(screenName, analyticsStep);
  }, []);

  const authService = useAuthService();
  // Steps for the other path (none / differences) are skipped
  const goNext = () => {
    const nextIndex = adjacentStepIndex(index, 1, data.screenTime ?? {});
    const nextStep = SCREEN_TIME_STEPS[nextIndex];
    // Account-last signup: the account is created right before the plan (the prototype's
    // "Create an account to see your 8-week plan"); account-first parents go straight on
    if (nextStep?.kind === 'plan' && !authService.isAuthenticated()) {
      navigation.navigate('CreateAccount', { next: 'ScreenTimeStep', nextParams: { step: nextIndex } });
      return;
    }
    navigation.push('ScreenTimeStep', { step: nextIndex });
  };
  // A step resumed from a saved draft has no history behind it
  const goBack = () => {
    const prevIndex = adjacentStepIndex(index, -1, data.screenTime ?? {});
    if (navigation.canGoBack()) navigation.goBack();
    else if (prevIndex >= 0) navigation.replace('ScreenTimeStep', { step: prevIndex });
    else navigation.replace('ChildIssue');
  };

  if (step.kind === 'question') {
    return (
      <QuestionStep
        step={step}
        index={index}
        screenName={screenName}
        analyticsStep={analyticsStep}
        values={values}
        context={context}
        onNext={goNext}
      />
    );
  }

  if (step.kind === 'plan') {
    return <PlanStep values={values} context={context} screenName={screenName} analyticsStep={analyticsStep} onBack={goBack} />;
  }

  return (
    <InsightStep
      step={step}
      values={values}
      context={context}
      onNext={() => {
        amplitudeService.trackOnboardingStepCompleted(screenName, analyticsStep);
        goNext();
      }}
      onBack={goBack}
    />
  );
};

const QuestionStep: React.FC<{
  step: ScreenTimeQuestionStep;
  index: number;
  screenName: string;
  analyticsStep: number;
  values: Record<string, unknown>;
  context?: string;
  onNext: () => void;
}> = ({ step, index, screenName, analyticsStep, values, context, onNext }) => {
  const { t } = useTranslation();
  const optionsKey = step.optionsKey ?? `${step.id}.options`;
  const prompt = step.subtitleKey ? t(`${NS}.${step.subtitleKey}`) : step.multi ? t(`${NS}.selectAll`) : '';
  // Optional per-question note shown under the prompt (e.g. differences)
  const note = t(`${NS}.${step.id}.note`, { ...values, context, defaultValue: '' });
  const subtitle = [prompt, note].filter(Boolean).join('\n') || undefined;

  return (
    <MultipleChoiceScreen
      headerText=""
      title={t(`${NS}.${step.titleKey ?? `${step.id}.title`}`, { ...values, context })}
      subtitle={subtitle}
      options={step.options.map((value) => ({
        value,
        label: t(`${NS}.${optionsKey}.${value}`, { ...values, context }),
      }))}
      dataField={`screenTime.${step.field}`}
      nextScreen="ScreenTimeStep"
      multiSelect={step.multi}
      exclusiveValues={step.exclusive}
      headerOverride={
        <OnboardingProgressHeader phase={2} step={index + 1} totalSteps={SCREEN_TIME_STEPS.length} singlePhase />
      }
      screenName={screenName}
      screenStep={analyticsStep}
      onBeforeNavigate={async () => {
        onNext();
        return false;
      }}
      titleStyle={questionStyles.title}
      subtitleStyle={questionStyles.subtitle}
      optionLabelStyle={questionStyles.option}
      optionCardStyle={questionStyles.optionCard}
      renderButtons={(props) => <OnboardingFooter {...props} />}
    />
  );
};

type InsightProps = {
  step: ScreenTimeInsightStep;
  values: Record<string, unknown>;
  context?: string;
  onNext: () => void;
  onBack: () => void;
};

// Shared i18n lookups for both insight renderers
const useInsightCopy = (step: ScreenTimeInsightStep, values: Record<string, unknown>) => {
  const { t } = useTranslation();
  const { data } = useOnboarding();
  const prefix = step.byPath ? `${step.id}.${screenTimePath(data.screenTime ?? {})}` : step.id;
  const key = (k: string) => `${NS}.${prefix}.${k}`;
  const age = childAgeYears(data.childBirthday);
  const cta = t(key('cta'), { ...values, defaultValue: '' }) || t(`${NS}.continue`);
  const blockKey = (k: string) => key(k);
  const blocks = INSIGHT_BLOCKS[prefix] ?? INSIGHT_BLOCKS[step.id] ?? [];
  return { t, key, age, cta, blockKey, blocks };
};

const InsightStep: React.FC<InsightProps> = ({ step, values, context, onNext, onBack }) => {
  const { t, key, age, cta, blockKey, blocks } = useInsightCopy(step, values);
  // Explicit size: a percentage width + aspectRatio didn't take effect on this Image
  const { width: windowWidth } = useWindowDimensions();
  const advisorWidth = (windowWidth - CONTENT_PADDING * 2) * ADVISOR_WIDTH_RATIO;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {step.media === 'advisor' ? (
          <>
            <Image
              source={require('../../../../assets/images/onboarding-screen-time/nora-clinical-advisor-card.png')}
              style={[styles.advisor, { width: advisorWidth, height: advisorWidth * (345 / 853) }]}
              resizeMode="contain"
              accessibilityLabel={t(key('advisorAlt'))}
            />
            <RichText i18nKey={key('tagline')} style={[styles.title, styles.centered]} values={values} context={context} />
          </>
        ) : (
          <RichText
            i18nKey={key('title')}
            style={[styles.title, LONG_TITLE_STEPS.has(step.id) && styles.longTitle]}
            values={values}
            context={context}
          />
        )}

        {blocks.map((block) => {
          const keys = Array.isArray(block.key) ? block.key : [block.key];
          return (
            <View key={keys.join()} style={block.kind === 'callout' ? styles.callout : undefined}>
              {keys.map((k) => (
                <RichText
                  key={k}
                  i18nKey={blockKey(k)}
                  style={styles.paragraph}
                  values={{ ...values, count: age ?? 0 }}
                  context={context}
                />
              ))}
            </View>
          );
        })}

        {(step.media === 'practiceScene' || step.media === 'playScene') && (
          <View style={styles.scene}>
            <ScreenTimeScene scene={step.media === 'practiceScene' ? 'practice' : 'play'} />
          </View>
        )}
      </ScrollView>

      <OnboardingFooter onBack={onBack} onContinue={onNext} continueText={cta} />
    </View>
  );
};

const PlanStep: React.FC<{
  values: Record<string, unknown>;
  context?: string;
  screenName: string;
  analyticsStep: number;
  onBack: () => void;
}> = ({ values, context, screenName, analyticsStep, onBack }) => {
  const { t } = useTranslation();
  const rootNavigation = useNavigation<RootStackNavigationProp>();
  const authService = useAuthService();
  const { data, completeOnboarding } = useOnboarding();
  const [isSaving, setIsSaving] = useState(false);
  const answers = data.screenTime ?? {};

  const asList = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);
  const label = (group: string, value: string) => t(`${NS}.${group}.options.${value}`, { ...values, context });
  const sep = t(`${NS}.plan.listSeparator`);

  const hardMoment = [
    // hardest options are full sentences; drop the final period inside the list
    ...asList(answers.hardest).map((v) => label('hardest', v).replace(/[.。]$/, '')),
  ].join(sep);
  const tried = asList(answers.strategies).map((v) => label('strategies', v)).join(sep);

  const [goalImageWidth, setGoalImageWidth] = useState(0);
  const beforeAfter =
    data.childGender === 'BOY'
      ? { source: require('../../../../assets/images/onboarding-screen-time/nora-two-month-before-after.jpg'), aspectRatio: 1000 / 420 }
      : data.childGender === 'GIRL'
        ? { source: require('../../../../assets/images/onboarding-screen-time/nora-girl-before-after.jpg'), aspectRatio: 1000 / 586 }
        : null;

  const handleFinish = async () => {
    setIsSaving(true);
    amplitudeService.trackOnboardingStepCompleted(screenName, analyticsStep);
    try {
      await authService.completeOnboarding({
        screenTimeIntake: buildScreenTimeIntake(answers),
        ...(data.relationshipToChild ? { relationshipToChild: data.relationshipToChild } : {}),
        ...(data.childGender ? { childGender: data.childGender } : {}),
      });
    } catch (error) {
      // Don't block the parent from finishing onboarding over a failed save
      console.error('[ScreenTime] Failed to save screen-time intake:', error);
    }
    await completeOnboarding();
    rootNavigation.replace('MainTabs');
  };

  // Plan card sections, in the prototype's order; empty answers are skipped
  const sections: { label: string; body: React.ReactNode }[] = [
    { label: 'hardMoment', body: hardMoment ? <Text style={styles.planStrong}>{hardMoment}</Text> : null },
    { label: 'tried', body: tried ? <Text style={styles.planStrong}>{tried}</Text> : null },
    {
      label: 'startWith',
      body: (
        <Trans
          i18nKey={`${NS}.plan.startWithBody`}
          values={values}
          components={{ b: <Text style={styles.planStrong} /> }}
        />
      ),
    },
  ].filter((section) => section.body);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, styles.planTitle]}>{t(`${NS}.plan.title`, values)}</Text>

        <View style={styles.goalBox}>
          <Text style={styles.goalTitle}>{t(`${NS}.plan.twoMonthGoal`, values)}</Text>
          {beforeAfter && (
            <View style={styles.goalComparison} onLayout={(e) => setGoalImageWidth(e.nativeEvent.layout.width)}>
              <View style={styles.goalLabels}>
                <Text style={styles.goalLabel}>{t(`${NS}.plan.before`)}</Text>
                <Text style={styles.goalLabel}>{t(`${NS}.plan.after`)}</Text>
              </View>
              {goalImageWidth > 0 && (
                <Image
                  source={beforeAfter.source}
                  // Explicit size: a percentage width + aspectRatio doesn't apply reliably on Image
                  style={[styles.beforeAfter, { width: goalImageWidth, height: goalImageWidth / beforeAfter.aspectRatio }]}
                  resizeMode="contain"
                  accessibilityLabel={t(`${NS}.plan.imageAlt`, { context })}
                />
              )}
            </View>
          )}
          <Text style={styles.disclaimer}>{t(`${NS}.plan.disclaimer`)}</Text>
        </View>

        <View style={styles.planCard}>
          {sections.map((section, i) => (
            <View key={section.label} style={[styles.planSection, i > 0 && styles.planSectionDivider]}>
              <Text style={styles.planLabel}>{t(`${NS}.plan.${section.label}`)}</Text>
              <Text style={styles.planRow}>{section.body}</Text>
            </View>
          ))}
          <View style={[styles.planSection, styles.planSectionDivider]}>
            <RichText i18nKey={`${NS}.plan.closing`} style={styles.planRow} values={values} />
          </View>
          <View style={[styles.planSection, styles.planSectionDivider, styles.planSectionLast]}>
            <Text style={[styles.planRow, styles.planFreeNote]}>{t(`${NS}.plan.free`)}</Text>
          </View>
        </View>
      </ScrollView>

      {isSaving ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#8C49D5" />
        </View>
      ) : (
        <OnboardingFooter onBack={onBack} onContinue={handleFinish} continueText={t(`${NS}.plan.cta`)} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: CONTENT_PADDING,
    paddingTop: 60,
    paddingBottom: 24,
  },
  advisor: {
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 32,
    lineHeight: 37,
    letterSpacing: -1.4,
    color: '#292631', // prototype title color
    marginBottom: 24,
  },
  longTitle: {
    fontSize: 26,
    lineHeight: 35,
    letterSpacing: -1.1,
  },
  centered: {
    textAlign: 'center',
  },
  paragraph: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 19,
    lineHeight: 33,
    color: '#1F2937',
    marginBottom: 16,
  },
  highlight: {
    fontFamily: 'DMSans_700Bold',
    color: '#8C49D5',
  },
  bold: {
    fontFamily: 'DMSans_700Bold',
  },
  callout: {
    backgroundColor: '#F6F3F7',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 16,
    // Extends into the 32pt page padding so callout text lines up with the body text
    marginHorizontal: -16,
  },
  scene: {
    width: '100%',
    aspectRatio: 320 / 120,
    marginTop: 8,
  },
  // Plan screen, after the prototype's .nora-plan-goal / .nora-plan (index.css)
  planTitle: {
    marginTop: 30,
  },
  goalBox: {
    backgroundColor: '#f4f0f8',
    borderLeftWidth: 3,
    borderLeftColor: '#806bb3',
    borderRadius: 13,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  goalTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 19,
    color: '#292631', // prototype title color
    lineHeight: 29,
  },
  goalComparison: {
    marginTop: 20,
    marginBottom: 15,
  },
  goalLabels: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  goalLabel: {
    flex: 1,
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: '#624a96',
    textAlign: 'center',
  },
  beforeAfter: {
    borderRadius: 10,
  },
  disclaimer: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    lineHeight: 24,
    color: '#64586f',
    marginTop: 8,
  },
  planCard: {
    borderWidth: 1,
    borderColor: '#e9e3ec',
    borderRadius: 13,
    backgroundColor: '#fffefd',
    marginBottom: 20,
    overflow: 'hidden',
  },
  planSection: {
    padding: 22,
  },
  planSectionDivider: {
    borderTopWidth: 1,
    borderTopColor: '#eee9ef',
  },
  planSectionLast: {
    backgroundColor: '#f8f5fa',
  },
  planLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#624a96',
    marginBottom: 9,
  },
  planRow: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    lineHeight: 30,
    color: '#5d5762',
  },
  planStrong: {
    fontFamily: 'DMSans_700Bold',
    color: '#624a96',
  },
  planFreeNote: {
    color: '#6b577e',
  },
  loading: {
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
});



// MultipleChoiceScreen overrides for the branch's question steps: prototype fonts,
// left-aligned title, squarer option cards (radius 12 vs the app's pill)
const questionStyles = StyleSheet.create({
  title: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 26,
    textAlign: 'left',
    marginTop: 20,
    color: '#292631', // prototype title color
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    textAlign: 'left',
  },
  option: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 17,
  },
  optionCard: {
    borderRadius: 12,
    paddingHorizontal: 16,
  },
});
