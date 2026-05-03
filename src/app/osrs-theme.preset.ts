import { deepMerge } from '@primeuix/utils/object';
import Aura from '@primeuix/themes/aura';
import { table } from 'console';

const osrsPreset = deepMerge({
    primitive: {
        surface: {
            0: '#f7edd1',
            50: '#f3e7ba',
            100: '#ead7a1',
            200: '#dbc28b',
            300: '#c9a858',
            400: '#b58f45',
            500: '#9c7a40',
            600: '#80613a',
            700: '#674f33',
            800: '#4f3f2f',
            900: '#1c160f'
        },
        primary: {
            50: '#fff5d7',
            100: '#f9e5ae',
            200: '#f0cb82',
            300: '#e1b55a',
            400: '#d2a250',
            500: '#c19b62',
            600: '#a67c48',
            700: '#8a6837',
            800: '#6b502f',
            900: '#3d2b19'
        },
        text: {
            color: '#2a1f10',
            muted: '#7f6d51',
            inverse: '#f5ecd9',
            hover: '#3f2f1c'
        }
    },
    components: {
        select: {
            background: '#f3e5ba',
            borderColor: '#2a1f10',
            color: '#2a1f10',
            hoverBackground: '#b8a979',
            hoverColor: '#ffffff',
            hoverBorderColor: '#74532f',
            focusBackground: '#fff4c5',
            focusBorderColor: '#d2b187',
            focusColor: '#2a1f10',
            placeholderColor: '#7e6647',
            disabledBackground: '#e9dec0',
            disabledBorderColor: '#9a8b6c',
            disabledColor: '#7d6f57',
            iconColor: '#8a6a3a',
            option: {
                padding: '5px',
                // background: '#f3e5ba',
                // color: '#2a1f10',
                // hoverBackground: '#b8a979',
                // hoverColor: '#ffffff',
                // selectedBackground: '#d8bf8c',
                // selectedColor: '#2a1f10',
                // focusBackground: '#b8a979',
                // focusColor: '#fef4e7'
            },
            overlay: {
                background: '#f3e5ba',
                borderColor: '#ac834f',
                color: '#2a1e0f'
            }
        },
        datatable: {
            bodyCell: {
                padding: '8'
            }
        },
        tooltip: {
            background: '#2b2418',
            color: '#f4e7b9',
            borderColor: '#8a6f3f',
            padding: '8px',
            borderRadius: '4px',
            fontSize: '14px',
            maxWidth: '300px',
            border: '1px solid #8a6f3f',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
        }
    },
    semantic: {
        text: {
            color: '#2a1f10',
            mutedColor: '#cfb782',
            hoverColor: '#3a2b18',
            inverseColor: '#f8eec8'
        },
        content: {
            background: '#2b2418',
            hoverBackground: '#342915',
            borderColor: '#8a6f3f',
            color: '#f4e7b9',
            mutedColor: '#d7c49f'
        },
        form: {
            field: {
                background: '#f3e5ba',
                borderColor: '#6a502b',
                hoverBorderColor: '#8a6f3f',
                focusBorderColor: '#d2b187',
                disabledBackground: '#e9dec0',
                disabledBorderColor: '#9a8b6c',
                disabledColor: '#7d6f57',
                color: '#2a1f10',
                placeholderColor: '#7e6647',
                iconColor: '#8a6a3a',
                filled: {
                    background: '#f7e7b7',
                    hover: {
                        background: '#fff6d2'
                    },
                    focus: {
                        background: '#fff4c5'
                    }
                }
            }
        },
        button: {
            root: {
                background: '#f3e4b6',
                hoverBackground: '#fff6d2',
                activeBackground: '#d8bf8c',
                borderColor: '#74532f',
                color: '#2a1e0f',
                hoverColor: '#1f160d'
            },
            outlined: {
                borderColor: '#74532f',
                color: '#2a1e0f',
                hoverBackground: '#fff6d2'
            },
            text: {
                color: '#2a1e0f',
                hoverColor: '#1f160d'
            }
        },
        overlay: {
            select: {
                background: '#f3e5ba',
                borderColor: '#2a1f10',
                color: '#2a1f10'
            },
            popover: {
                background: '#fbf2da',
                borderColor: '#ac834f',
                color: '#2a1e0f'
            }
        },
        divider: {
            color: '#8a6f3f'
        },
        highlight: {
            background: '#e1c664',
            color: '#2a1f10'
        },
        surface: {
            background: '#2b2418',
            color: '#f4e7b9'
        }
    }
});

export default osrsPreset;
