/**
 * Terms and Conditions Screen
 * Displays the app's terms and conditions
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, COLORS } from '../constants/assets';

export const TermsAndConditionsScreen: React.FC = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms and Conditions</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.lastUpdated}>Effective Date: 1st Dec 2025</Text>

          <Text style={styles.sectionTitle}>1. Agreement to Terms</Text>
          <Text style={styles.paragraph}>
            These Terms of Service ("Terms") constitute a legally binding agreement between you, the user (referred to as "Parent," "You," or "Your"), and Nora AI, a company incorporated in Singapore (referred to as "Company," "We," "Us," or "Our"), concerning your access to and use of the Nora mobile application and any related services (collectively, the "Service"). The Company allows you to among other things, submit store and access certain data and other information related as applicable including and not limited to information related to your Child (collectively, "User Data").
          </Text>
          <Text style={styles.paragraph}>
            Carefully read through the terms and clauses to understand the eligibility requirements, rights and obligations, liability and other related terms of this agreement.
          </Text>
          <Text style={styles.paragraph}>
            Subject to applicable law, the Company may change or discontinue, temporarily or permanently, any feature or component of the Services at any time without notice.
          </Text>
          <Text style={styles.paragraph}>
            By registering, accessing, subscribing or using or continuing to use the Service, you are bound by these Terms of Service, and confirms that you have read, understood, and agree to be bound by all of these Terms including any additional guidelines and future modifications.
          </Text>
          <Text style={styles.warningText}>
            IF YOU DO NOT AGREE WITH ALL OF THESE TERMS, THEN YOU ARE EXPRESSLY PROHIBITED FROM USING THE SERVICE AND YOU MUST DISCONTINUE USE IMMEDIATELY.
          </Text>

          <Text style={styles.sectionTitle}>2. Eligibility and Parental Consent</Text>
          <Text style={styles.subsectionTitle}>2.1. User Eligibility (Parent)</Text>
          <Text style={styles.paragraph}>
            The Service is intended for use by parents or legal guardians of a Child, who are at least 18 years of age or the age of legal majority in their jurisdiction. By using the Service, you represent and warrant that you meet this age requirement.
          </Text>
          <Text style={styles.subsectionTitle}>2.2. Child Data and Consent</Text>
          <Text style={styles.paragraph}>
            The Service involves the collection of voice recordings of children between the ages of 2 and 7 (the "Child").
          </Text>
          <Text style={styles.bulletPoint}>• You must be the parent or legal guardian of the Child whose voice is recorded and uploaded to the Service.</Text>
          <Text style={styles.bulletPoint}>• By submitting a voice recording of a Child, you represent and warrant that you have the legal authority to provide your informed consent for the collection, use, and processing of your and your Child's personal data, including their voice recording, as described in these Terms and our Privacy Policy.</Text>
          <Text style={styles.bulletPoint}>• You acknowledge that the Service is not directed to children and that the Service is intended for your use as a parent or legal guardian.</Text>
          <Text style={styles.bulletPoint}>• You understand and confirm that the Company is not a licensed medical provider and does not provide medical care, medical treatment and any healthcare services. We only provide coaching and therapy services and do not intend at any time to provide medical treatment diagnosis or healthcare services to you or your Child.</Text>
          <Text style={styles.bulletPoint}>• No information provided on this Platform are intended to be used for medical emergencies.</Text>
          <Text style={styles.warningText}>
            ALWAYS SEEK THE ADVICE OF YOUR DOCTOR OR A HEALTHCARE PROVIDER REGARDING A MEDICAL CONDITION OR TREATMENT.
          </Text>

          <Text style={styles.sectionTitle}>3. The Service</Text>
          <Text style={styles.subsectionTitle}>3.1. Description of Service</Text>
          <Text style={styles.paragraph}>
            The Service is a mobile application that provides personalized parenting coaching. This involves:
          </Text>
          <Text style={styles.bulletPoint}>• The Parent recording a 5-minute play session with their Child (the "Voice Recording").</Text>
          <Text style={styles.bulletPoint}>• The Voice Recording being analyzed by Artificial Intelligence (AI) to generate a coaching report.</Text>
          <Text style={styles.bulletPoint}>• The Voice Recording and related data being used for human annotation by professional counsellors to improve the AI model and service quality.</Text>
          <Text style={styles.bulletPoint}>• The Voice Recording being used for research purposes, provided it is anonymized or de-identified in accordance with our Privacy Policy.</Text>
          <Text style={styles.subsectionTitle}>3.2. Third-Party Services</Text>
          <Text style={styles.paragraph}>
            The Service relies on third-party providers for hosting, processing, and analysis. You acknowledge and agree that:
          </Text>
          <Text style={styles.bulletPoint}>• Hosting: Our Service and data are hosted on cloud providers, such as Amazon Web Services (AWS).</Text>
          <Text style={styles.bulletPoint}>• AI Processing: Voice Recordings are processed through third-party APIs, such as ElevenLabs, for transcription and analysis.</Text>
          <Text style={styles.bulletPoint}>• We are not responsible for the terms, policies, or practices of any third-party services. Your use of such services is at your own risk and subject to their respective terms and conditions.</Text>

          <Text style={styles.sectionTitle}>4. Intellectual Property Rights</Text>
          <Text style={styles.subsectionTitle}>4.1. Our Content</Text>
          <Text style={styles.paragraph}>
            Unless otherwise indicated, the Service and all content, features, and functionality (including, but not limited to, all information, software, text, displays, images, video, and audio, and the design, selection, and arrangement thereof) are owned by the Company, its licensors, or other providers of such material and are protected by Singapore and international copyright, trademark, patent, trade secret, and other intellectual property or proprietary rights laws.
          </Text>
          <Text style={styles.paragraph}>
            Subject to these Terms of Service, the Company hereby grants to you a personal, non-transferable, non-exclusive, revocable, royalty free limited license to install and use our platform on your mobile device for the sole purposes of receiving and participating in the Services we provide. You will not have the right to sub licenses or resell the Services or any part thereof. You will have no right over any and all of the Company's intellectual Property.
          </Text>
          <Text style={styles.subsectionTitle}>4.2. User Content (Voice Recordings)</Text>
          <Text style={styles.paragraph}>
            You retain all ownership rights in your Voice Recordings and any other content you submit to the Service ("User Content").
          </Text>
          <Text style={styles.bulletPoint}>• License Grant: By submitting User Content, you grant the Company a worldwide, non-exclusive, royalty-free, sublicensable, and transferable license to use, reproduce, distribute, prepare derivative works of, display, and perform the User Content in connection with the Service and the Company's (and its successors' and affiliates') business, including without limitation for promoting and redistributing part or all of the Service (and derivative works thereof) in any media formats and through any media channels.</Text>
          <Text style={styles.bulletPoint}>• Research Use: You specifically grant the Company (and its successors' and affiliates') the right to use the Voice Recordings for internal research and development purposes, including the training and improvement of our AI models, provided that such use is conducted only after the Voice Recordings have been anonymized or de-identified to remove any personally identifiable information of the Child or Parent.</Text>

          <Text style={styles.sectionTitle}>5. Acceptable Use</Text>
          <Text style={styles.paragraph}>
            You agree not to use the Service for any purpose that is unlawful or prohibited by these Terms. Specifically, you agree not to:
          </Text>
          <Text style={styles.bulletPoint}>• Upload any content that is illegal, harmful, threatening, abusive, harassing, defamatory, vulgar, obscene, or otherwise objectionable.</Text>
          <Text style={styles.bulletPoint}>• Use the Service to record any person without their knowledge and, where required, consent.</Text>
          <Text style={styles.bulletPoint}>• Use the Service in a manner that violates the privacy rights of any third party, including the Child.</Text>

          <Text style={styles.sectionTitle}>6. Data Privacy and Security</Text>
          <Text style={styles.paragraph}>
            Your privacy is important to us. Please read our Privacy Policy, which is incorporated into these Terms by reference. The Privacy Policy explains how we collect, use, discloses and secure you and your Child's personally identifiable information in connection with your use of the Service. When you create an account or click "I Accept" button or a similar equivalent regarding access and use of the Service and our Platform, you have indicated that you have agreed to the terms of the Privacy Policy.
          </Text>
          <Text style={styles.bulletPoint}>• Data Transfer: You acknowledge that your data, including Voice Recordings, may be transferred to and processed in countries outside of Singapore, including the United States (where AWS and ElevenLabs may be located). We will take all steps reasonably necessary to ensure that your data is treated securely and in accordance with our Privacy Policy and applicable laws.</Text>
          <Text style={styles.bulletPoint}>• Data Security: We implement reasonable technical and organizational measures to protect your data. However, you acknowledge that no electronic transmission or storage is 100% secure.</Text>

          <Text style={styles.sectionTitle}>7. Termination</Text>
          <Text style={styles.paragraph}>
            We may terminate or suspend your access to the Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
          </Text>

          <Text style={styles.sectionTitle}>8. Governing Law and Dispute Resolution</Text>
          <Text style={styles.subsectionTitle}>8.1. Governing Law</Text>
          <Text style={styles.paragraph}>
            These Terms shall be governed by and construed in accordance with the laws of the Republic of Singapore.
          </Text>
          <Text style={styles.subsectionTitle}>8.2. Dispute Resolution</Text>
          <Text style={styles.paragraph}>
            Any dispute arising out of or in connection with these Terms, including any question regarding its existence, validity, or termination, shall be referred to and finally resolved by arbitration in Singapore in accordance with the Arbitration Rules of the Singapore International Arbitration Centre ("SIAC Rules") for the time being in force, which rules are deemed to be incorporated by reference in this clause. The seat of the arbitration shall be Singapore. The Tribunal shall consist of one (1) arbitrator. The language of the arbitration shall be English.
          </Text>

          <Text style={styles.sectionTitle}>9. Force Majeure</Text>
          <Text style={styles.paragraph}>
            The Company shall not be liable for failure to perform any of its obligations hereunder during any period in which such performance is delayed or impracticable due to circumstances beyond our reasonable control including without limitation earthquakes, fire, flood, war, embargo, inability to secure materials, transportation, power utilities, intervention of any governmental authority or acts of nature.
          </Text>

          <Text style={styles.sectionTitle}>10. Complete Agreement</Text>
          <Text style={styles.paragraph}>
            These terms contain the complete and entire agreement understanding of the parties regarding the subject matter hereof and supersede all proposals, oral or written, all negotiations conversations, discussions and past course of dealing between you and us relating thereto.
          </Text>
          <Text style={styles.paragraph}>
            You agree that execution of these terms may occur by manifesting your acceptance of it when you use our Service and that no signature is required in order to form a binding agreement.
          </Text>

          <Text style={styles.sectionTitle}>11. Modification of Terms</Text>
          <Text style={styles.paragraph}>
            We reserve the right, to update, change modify add or remove portions of these Terms at any time for various reasons. We will provide you reasonable advance notice of material changes that negatively impact your use of the Service. This notice will be on the policy page. You agree to review these Terms periodically for changes. If you do not agree to the modified terms, you can stop using the Service by notifying us through the app's support section.
          </Text>

          <Text style={styles.sectionTitle}>12. Waiver</Text>
          <Text style={styles.paragraph}>
            Our failure to exercise or enforce any right or provision of these Terms will not constitute a waiver of such right or provision unless such waiver is confirmed in writing by the Company.
          </Text>

          <Text style={styles.sectionTitle}>13. Severability</Text>
          <Text style={styles.paragraph}>
            In the event any of these Terms is held by a court of competent jurisdiction to be unenforceable, such unenforceability shall not affect the remaining terms of these Terms in such jurisdiction or render unenforceable or invalidate such terms and provisions in other jurisdictions.
          </Text>
          <Text style={styles.paragraph}>
            In the event any of the Terms is determined to be invalid under any applicable statute or rule of law they shall be severed from the rest of the Terms and the remaining provisions of these Terms shall survive and be interpreted so as best to reasonably effect the intent of the parties. The parties agree that the Company can replace any invalid or unenforceable provisions in a manner in order for the transactions contemplated hereby to be completed as originally contemplated to the extent possible.
          </Text>

          <Text style={styles.sectionTitle}>14. Notices</Text>
          <Text style={styles.paragraph}>
            All notices and other disclosures provided to you in connection with the provision of our Services, shall be made by postings on our website and/or communications sent to the email address provided by you when you registered to use our Service.
          </Text>

          <Text style={styles.sectionTitle}>15. Disclaimers</Text>
          <Text style={styles.paragraph}>
            Our Platform is provided "as is" and "as available" without warranties of any kind either express or implied. We do not warrant that the functions contained in the Platform will be uninterrupted or error-free, that the Platform will meet your requirements, that defects will be corrected or that the Platform or the server that makes it available is free of viruses or other harmful components.
          </Text>

          <Text style={styles.sectionTitle}>16. Limitations of Liability</Text>
          <Text style={styles.paragraph}>
            We will not under any circumstances, including, but not limited to, negligence, be liable for any special, indirect, incidental, consequential, punitive, reliance, or exemplary damages (including without limitation losses or liability resulting from loss of data, loss of revenue, anticipated profits, or loss of business opportunity) that result from your use or your inability to use the information or materials on the Platform, or any other interactions with us, even if we or our authorized representative has been advised of the possibility of such damages.
          </Text>
          <Text style={styles.paragraph}>
            In no event is our total liability to you for all damages, losses, and causes of action arising out of or relating to these terms or your use of the Platform, including without limitation your interactions with other users, (whether in contract, tort including negligence, warranty, or otherwise) exceed the amount paid by you, if any, for accessing the Platform during the twelve (12) months immediately preceding the day the act or omission occurred that gave rise to your claim.
          </Text>
          <Text style={styles.paragraph}>
            Upon request by us, you agree to defend, indemnify and hold us and our partners, affiliates, service providers, licensors, suppliers, officers, directors, employees and agents harmless from and against any and all losses, liabilities, damages and costs, including but not limited to reasonable legal and accounting fees, arising from any claims, actions or demands related to or alleged to relate to: (a) your violation of these Terms of Service; or (b) your violation or infringement of any intellectual property or other third party rights or any applicable law in connection with your use of the Platform.
          </Text>

          <Text style={styles.sectionTitle}>17. Contact Information</Text>
          <Text style={styles.paragraph}>
            For any questions or concerns regarding these Terms, please contact us through the app's support section.
          </Text>

          <Text style={styles.warningText}>
            YOU ACKNOWLEDGE THAT YOU HAVE READ THESE TERMS OF SERVICE, UNDERSTAND THEM, AND AGREE TO BE BOUND BY THEM BY CONTINUING TO USE OUR SERVICES.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: '#1F2937',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  lastUpdated: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: '#1F2937',
    marginTop: 24,
    marginBottom: 12,
  },
  subsectionTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 24,
    color: '#374151',
    marginBottom: 16,
  },
  bulletPoint: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 24,
    color: '#374151',
    marginBottom: 12,
    paddingLeft: 8,
  },
  warningText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    lineHeight: 24,
    color: '#374151',
    marginBottom: 16,
    marginTop: 8,
  },
});
