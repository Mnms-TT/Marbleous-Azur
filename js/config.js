export const Config = {
    BUBBLE_COLORS: [
        { main: '#c62b39', shadow: '#69050d' }, { main: '#ffd304', shadow: '#957e18' }, { main: '#3bda0e', shadow: '#108209' },
        { main: '#3ee2ee', shadow: '#2babb4' }, { main: '#5c68de', shadow: '#18169b' }, { main: '#af00c1', shadow: '#860094' },
        { main: '#d8d6db', shadow: '#636b60' }
    ],
    TEAM_COLORS: ['#3B82F6', '#22C55E', '#F97316', '#EC4899', '#8B5CF6'],
    SPELLS: {
        plateauIncline: { name: 'Plateau Incliné', icon: 'icons/sort_tilt.png', color: '#c62b39' },
        canonEndommage: { name: 'Canon endommagé', icon: 'icons/sort_canon.png', color: '#ffd304' },
        sabotageSorts: { name: 'Sabotage de Sorts', icon: 'icons/sort_cancel.png', color: '#3bda0e' },
        canonArcEnCiel: { name: 'Canon Arc-en-ciel', icon: 'icons/sort_rainbow.png', color: '#3ee2ee' },
        monteeLignes: { name: 'Montée des Lignes', icon: 'icons/sort_addline.png', color: '#5c68de' },
        nukeBomb: { name: 'NukeBomb', icon: 'icons/sort_nuke.png', color: '#af00c1' },
        colonneMonochrome: { name: 'Colonne Monochrome', icon: 'icons/sort_monocolor.png', color: '#d8d6db' },
    },
    COLOR_TO_SPELL_MAP: {
        '#c62b39': 'plateauIncline', '#ffd304': 'canonEndommage', '#3bda0e': 'sabotageSorts', '#3ee2ee': 'canonArcEnCiel',
        '#5c68de': 'monteeLignes', '#af00c1': 'nukeBomb', '#d8d6db': 'colonneMonochrome',
    },
    MAX_SPELLS: 8, 
    GRID_ROWS: 14,
    GRID_COLS: 8, 
    GAME_OVER_ROW: 11,
    GRID_VERTICAL_OFFSET: 0,
    SPELL_SPAWN_CHANCE: 0.50, 
    FPS: 60,
    LAUNCHER_ROTATION_SPEED: 0.03,
};