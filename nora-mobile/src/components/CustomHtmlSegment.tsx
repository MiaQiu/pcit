import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

interface Props {
  html: string;
}

const INJECTED_CSS = `
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: transparent; }
    body > * { width: 100% !important; height: 100% !important; max-width: 100% !important; aspect-ratio: auto !important; }
  </style>
`;

export const CustomHtmlSegment: React.FC<Props> = ({ html }) => {
  const source = {
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover"/>
  <script src="https://cdn.tailwindcss.com"></script>
  ${INJECTED_CSS}
</head>
<body>${html}</body>
</html>`,
  };

  return (
    <View style={styles.container}>
      <WebView
        source={source}
        style={styles.webview}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        renderLoading={() => <ActivityIndicator style={StyleSheet.absoluteFill} />}
        startInLoadingState
        originWhitelist={['*']}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
