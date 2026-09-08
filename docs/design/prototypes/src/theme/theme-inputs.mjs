// Semantic roles come from tokens.css. This file maps them to the official v10 Sass API.
export function themeDensity(touch) {
  return {
    font: touch ? '1rem' : '0.875rem',
    padding: touch ? '0.5625rem 0.75rem' : '0.40625rem 0.75rem',
    iconSize: touch ? '2.75rem' : '2.25rem',
    controlHeight: touch ? '44px' : '36px',
  };
}

export function createThemeInputs(token, { theme, touch }) {
  // The official source adds fixed rem lengths (for example InputOtp), so use
  // numeric rem inputs. At the browser's 16px root these are 14/16 and 36/44px.
  const { font, padding, iconSize: size } = themeDensity(touch);
  const surface = token('surface');
  const text = token('text');
  const secondary = token('text-secondary');
  const border = token('border');
  const hover = token('surface-hover');
  const accent = token('accent');
  const accentHover = token('accent-hover');
  const inputs = {
    primaryColor: accent,
    primaryLightColor: theme === 'dark' ? accentHover : token('accent-soft'),
    primaryLighterColor: accentHover,
    primaryLightestColor: token('accent-soft'),
    primaryDarkColor: accentHover,
    primaryDarkerColor: accentHover,
    primaryTextColor: token('on-accent'),
    highlightBg: token('accent-soft'),
    highlightTextColor: token('on-accent-soft'),
    highlightFocusBg: `mix(${accent}, ${token('accent-soft')}, 12%)`,
    fontFamily: token('font-sans'),
    fontSize: font,
    inputTextFontSize: font,
    primeIconFontSize: font,
    fontWeight: '400',
    textColor: text,
    textSecondaryColor: secondary,
    borderRadius: token('radius-control'),
    divider: `1px solid ${border}`,
    transitionDuration: token('duration-quick'),
    maskBg: token('scrim'),
    errorColor: token('danger'),
    focusOutlineColor: token('focus'),
    focusOutline: '0 none',
    focusOutlineOffset: '0',
    focusShadow: `0 0 0 0.2rem ${token('accent-soft')}`,
    actionIconWidth: size,
    actionIconHeight: size,
    actionIconColor: secondary,
    actionIconHoverColor: text,
    actionIconHoverBg: hover,
    inputPadding: padding,
    inputBg: surface,
    inputTextColor: text,
    inputIconColor: secondary,
    inputBorder: `1px solid ${token('border-control')}`,
    inputHoverBorderColor: secondary,
    inputFocusBorderColor: token('focus'),
    inputPlaceholderTextColor: token('text-muted'),
    inputFilledBg: token('surface-secondary'),
    inputFilledHoverBg: hover,
    inputFilledFocusBg: surface,
    inputGroupBg: token('surface-secondary'),
    inputGroupTextColor: secondary,
    inputGroupAddOnMinWidth: size,
    inputListBg: surface,
    inputListTextColor: text,
    inputListPadding: '6px',
    inputListItemPadding: touch ? '0.625rem 0.75rem' : '0.46875rem 0.75rem',
    inputListItemTextColor: text,
    inputListItemHoverBg: hover,
    inputListItemTextHoverColor: text,
    inputListItemFocusBg: hover,
    inputListItemTextFocusColor: text,
    inputListItemBorderRadius: token('radius-small'),
    inputListHeaderBg: token('surface-secondary'),
    inputListHeaderTextColor: text,
    inputListHeaderBorder: `1px solid ${border}`,
    inputListHeaderPadding: '12px',
    inputOverlayBg: surface,
    inputOverlayHeaderBg: token('surface-secondary'),
    inputOverlayShadow: token('shadow-floating'),
    buttonPadding: padding,
    buttonIconOnlyWidth: size,
    buttonIconOnlyPadding: touch ? '0.5625rem 0' : '0.40625rem 0',
    plainButtonTextColor: secondary,
    plainButtonHoverBgColor: hover,
    plainButtonActiveBgColor: token('surface-secondary'),
    inputSwitchSliderOffBg: token('border-control'),
    inputSwitchSliderOffHoverBg: secondary,
    inputSwitchHandleOffBg: surface,
    inputSwitchHandleOnBg: token('on-accent'),
    panelContentBg: surface,
    panelContentTextColor: text,
    panelHeaderBg: token('surface-secondary'),
    panelHeaderTextColor: text,
    panelContentEvenRowBg: token('surface-secondary'),
    tableBodyRowEvenBg: token('surface-secondary'),
    dialogHeaderBg: surface,
    dialogHeaderTextColor: text,
    overlayContentBg: surface,
    overlayContentBorder: `1px solid ${border}`,
    overlayContainerShadow: token('shadow-floating'),
    menuBg: surface,
    menuTextColor: text,
    tooltipBg: text,
    tooltipTextColor: surface,
    toastShadow: token('shadow-floating'),
    toastBorderWidth: '1px',
    messageBorderWidth: '1px',
    messageTextFontSize: font,
    inlineMessageTextFontSize: font,
    progressBarBg: token('surface-secondary'),
    progressBarHeight: '6px',
    skeletonBg: token('surface-secondary'),
    skeletonAnimationBg: surface,
    hoverBg: hover,
  };

  // Lara's dark palette numbers have different roles from its light palette.
  const shades = theme === 'dark'
    ? { '000': text, '100': secondary, '500': token('border-control'), '600': border, '700': token('surface-secondary'), '800': surface, '900': token('canvas') }
    : { '000': surface, '100': token('surface-secondary'), '200': hover, '300': border, '400': token('border-control'), '500': token('text-muted'), '600': secondary, '700': text, '800': text, '900': text };
  for (const [name, value] of Object.entries(shades)) inputs[`shade${name}`] = value;

  const onSemantic = theme === 'dark' ? token('canvas') : surface;
  for (const [name, role] of [['success', 'success'], ['info', 'info'], ['warning', 'warning'], ['danger', 'danger'], ['help', 'info']]) {
    const color = token(role);
    Object.assign(inputs, {
      [`${name}ButtonBg`]: color,
      [`${name}ButtonTextColor`]: onSemantic,
      [`${name}ButtonBorder`]: `1px solid ${color}`,
      [`${name}ButtonHoverBg`]: `mix(${text}, ${color}, 10%)`,
      [`${name}ButtonTextHoverColor`]: onSemantic,
      [`${name}ButtonHoverBorderColor`]: `mix(${text}, ${color}, 10%)`,
      [`${name}ButtonActiveBg`]: `mix(${text}, ${color}, 18%)`,
      [`${name}ButtonTextActiveColor`]: onSemantic,
      [`${name}ButtonActiveBorderColor`]: `mix(${text}, ${color}, 18%)`,
      [`${name}ButtonFocusShadow`]: `0 0 0 0.2rem ${token(`${role}-soft`)}`,
    });
    if (name !== 'help') {
      const message = name === 'danger' ? 'error' : name;
      Object.assign(inputs, {
        [`${message}MessageBg`]: token(`${role}-soft`),
        [`${message}MessageBorder`]: `solid ${color}`,
        [`${message}MessageTextColor`]: color,
        [`${message}MessageIconColor`]: color,
      });
    }
  }
  for (const name of ['secondary', 'contrast']) {
    Object.assign(inputs, {
      [`${name}ButtonBg`]: secondary,
      [`${name}ButtonTextColor`]: surface,
      [`${name}ButtonBorder`]: `1px solid ${secondary}`,
      [`${name}ButtonHoverBg`]: text,
      [`${name}ButtonTextHoverColor`]: surface,
      [`${name}ButtonHoverBorderColor`]: text,
      [`${name}ButtonActiveBg`]: text,
      [`${name}ButtonTextActiveColor`]: surface,
      [`${name}ButtonActiveBorderColor`]: text,
      [`${name}ButtonFocusShadow`]: `0 0 0 0.2rem ${token('surface-secondary')}`,
    });
  }
  return inputs;
}
