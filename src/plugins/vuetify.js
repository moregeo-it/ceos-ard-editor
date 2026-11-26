import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg';

const vuetify = createVuetify({
  components,
  directives,
  // Outlined fields throughout the app, also in forms that don't set a variant (e.g. JSON Forms)
  defaults: {
    VTextField: { variant: 'outlined' },
    VTextarea: { variant: 'outlined' },
    VSelect: { variant: 'outlined' },
    VAutocomplete: { variant: 'outlined' },
    VCombobox: { variant: 'outlined' },
    VNumberInput: { variant: 'outlined' },
    VFileInput: { variant: 'outlined' },
  },
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi,
    },
  },
  theme: {
    defaultTheme: 'system',
    themes: {
      light: {
        colors: {
          primary: '#3e5265',
        },
      },
      dark: {
        colors: {
          primary: '#3e5265',
        },
      },
    },
  },
});

export default vuetify;
