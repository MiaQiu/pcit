import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { OnboardingProvider } from './contexts/OnboardingContext';

// Screens
import LandingScreen from './screens/LandingScreen';
import LoginScreen from './screens/LoginScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import CreateAccountScreen from './screens/CreateAccountScreen';

// Demo screens
import Demo1Screen from './screens/demo/Demo1Screen';
import Demo1BScreen from './screens/demo/Demo1BScreen';
import Demo2Screen from './screens/demo/Demo2Screen';
import Demo2BScreen from './screens/demo/Demo2BScreen';
import Demo3Screen from './screens/demo/Demo3Screen';
import Demo4Screen from './screens/demo/Demo4Screen';
import Demo5Screen from './screens/demo/Demo5Screen';

// Onboarding screens
import ParentingIntroScreen from './screens/onboarding/ParentingIntroScreen';
import NameInputScreen from './screens/onboarding/NameInputScreen';
import RelationshipScreen from './screens/onboarding/RelationshipScreen';
import ChildNameScreen from './screens/onboarding/ChildNameScreen';
import ChildGenderScreen from './screens/onboarding/ChildGenderScreen';
import ChildBirthdayScreen from './screens/onboarding/ChildBirthdayScreen';
import ChildIssueScreen from './screens/onboarding/ChildIssueScreen';
import ChildSnapshotIntroScreen from './screens/onboarding/ChildSnapshotIntroScreen';
import WacbQuestionScreen from './screens/onboarding/WacbQuestionScreen';
import ChildBehaviorProfileScreen from './screens/onboarding/ChildBehaviorProfileScreen';
import Intro3Screen from './screens/onboarding/Intro3Screen';

// Play session screens
import PlaySession1Screen from './screens/play/PlaySession1Screen';
import PlaySession2Screen from './screens/play/PlaySession2Screen';
import PlaySession3Screen from './screens/play/PlaySession3Screen';
import PlaySession4Screen from './screens/play/PlaySession4Screen';
import PlaySession5Screen from './screens/play/PlaySession5Screen';

// Final screens
import SubscriptionScreen from './screens/SubscriptionScreen';
import SuccessScreen from './screens/SuccessScreen';
import PartnerLandingScreen from './screens/PartnerLandingScreen';

export default function App() {
  return (
    <BrowserRouter basename="/signup">
      <OnboardingProvider>
        <Routes>
          {/* Partner landing — QR code destination */}
          <Route path="/p/:slug" element={<PartnerLandingScreen />} />

          {/* Landing & Auth */}
          <Route path="/" element={<LandingScreen />} />
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
          <Route path="/create-account" element={<CreateAccountScreen />} />

          {/* Demo slides */}
          <Route path="/demo/1" element={<Demo1Screen />} />
          <Route path="/demo/1b" element={<Demo1BScreen />} />
          <Route path="/demo/2" element={<Demo2Screen />} />
          <Route path="/demo/2b" element={<Demo2BScreen />} />
          <Route path="/demo/3" element={<Demo3Screen />} />
          <Route path="/demo/4" element={<Demo4Screen />} />
          <Route path="/demo/5" element={<Demo5Screen />} />

          {/* Onboarding */}
          <Route path="/onboarding/parenting-intro" element={<ParentingIntroScreen />} />
          <Route path="/onboarding/name" element={<NameInputScreen />} />
          <Route path="/onboarding/relationship" element={<RelationshipScreen />} />
          <Route path="/onboarding/child-name" element={<ChildNameScreen />} />
          <Route path="/onboarding/child-gender" element={<ChildGenderScreen />} />
          <Route path="/onboarding/child-birthday" element={<ChildBirthdayScreen />} />
          <Route path="/onboarding/child-issue" element={<ChildIssueScreen />} />
          <Route path="/onboarding/snapshot-intro" element={<ChildSnapshotIntroScreen />} />
          <Route path="/onboarding/wacb/:questionNumber" element={<WacbQuestionScreen />} />
          <Route path="/onboarding/behavior-profile" element={<ChildBehaviorProfileScreen />} />
          <Route path="/onboarding/intro3" element={<Intro3Screen />} />

          {/* Play sessions */}
          <Route path="/play/1" element={<PlaySession1Screen />} />
          <Route path="/play/2" element={<PlaySession2Screen />} />
          <Route path="/play/3" element={<PlaySession3Screen />} />
          <Route path="/play/4" element={<PlaySession4Screen />} />
          <Route path="/play/5" element={<PlaySession5Screen />} />

          {/* Subscription & Success */}
          <Route path="/subscribe" element={<SubscriptionScreen />} />
          <Route path="/success" element={<SuccessScreen />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </OnboardingProvider>
    </BrowserRouter>
  );
}
