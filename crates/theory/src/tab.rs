//! Tablature (ADR 0016): which string and fret plays each note of a melody on
//! a fretted instrument. Standard notation says what and when to play; tab
//! says where.
//!
//! Fingering model: the fretting hand sits in a *position*, the index finger
//! at fret `p` and one finger per fret, so frets `p..=p + POSITION_REACH` are
//! in reach. Open strings can be played from any position. Every way to play
//! each note is a choice; the cheapest path through the choices wins
//! (dynamic programming). Moving the hand, playing high up the neck and
//! fretting a note that an open string could play all cost something. So the
//! result is what a player reading in the lowest position would choose,
//! shifting only when the melody leaves the hand's reach.

use serde::{Deserialize, Serialize};

use crate::instrument::Instrument;

/// Highest fret tab uses: positions stay in the lower half of the neck.
pub const MAX_TAB_FRET: i32 = 12;
/// Frets above the index finger the hand reaches without moving (one finger
/// per fret, four fingers).
const POSITION_REACH: i32 = 3;
/// Cost of moving the hand to another position, plus `SHIFT_PER_FRET` for
/// every fret it travels: a few long notes in a high position beat jumping
/// back and forth.
const SHIFT_COST: u32 = 4;
const SHIFT_PER_FRET: u32 = 1;
/// Cost per note for each fret the hand sits above the first position: play
/// as low on the neck as the melody allows.
const HEIGHT_COST: u32 = 1;
/// Cost of a fretted note: an open string needs no finger, so it is chosen
/// when it is in the position anyway (as in first-position reading).
const FRETTED_COST: u32 = 1;

/// Where one note is played.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TabPosition {
    /// 1 = the highest string, the top line of the tab (as tab numbers them).
    pub string: u8,
    /// 0 = the open string.
    pub fret: u8,
}

/// A melody's tab: one position per note.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tablature {
    /// Lines of the tab: the instrument's strings.
    pub strings: u8,
    /// Where each note is played, in the order of the notes.
    pub positions: Vec<TabPosition>,
}

/// How to play the sounding MIDI notes `midis` on `instrument`. `None` if the
/// instrument is not written in tab, or a note is below its lowest string or
/// above `MAX_TAB_FRET` on every string.
pub fn tablature(instrument: Instrument, midis: &[i32]) -> Option<Tablature> {
    let strings = instrument.tab_strings()?;
    // Every way to play each note: (string index, fret).
    let choices: Vec<Vec<(usize, i32)>> = midis
        .iter()
        .map(|&midi| {
            strings
                .iter()
                .enumerate()
                .filter_map(|(s, &open)| {
                    let fret = midi - open;
                    (0..=MAX_TAB_FRET).contains(&fret).then_some((s, fret))
                })
                .collect()
        })
        .collect();
    if choices.iter().any(Vec::is_empty) {
        return None;
    }
    let path = cheapest_path(&choices);
    let positions = path
        .into_iter()
        .zip(&choices)
        .map(|(c, notes)| {
            let (string, fret) = notes[c];
            TabPosition {
                string: string as u8 + 1,
                fret: fret as u8,
            }
        })
        .collect();
    Some(Tablature {
        strings: strings.len() as u8,
        positions,
    })
}

/// Hand positions (index finger fret) a choice can be played from.
fn positions_for(fret: i32) -> std::ops::RangeInclusive<i32> {
    if fret == 0 {
        1..=MAX_TAB_FRET
    } else {
        (fret - POSITION_REACH).max(1)..=fret
    }
}

fn shift_cost(from: i32, to: i32) -> u32 {
    if from == to {
        0
    } else {
        SHIFT_COST + SHIFT_PER_FRET * from.abs_diff(to)
    }
}

/// Index of the chosen way to play each note. States are (choice, hand
/// position); ties go to the earlier choice and the lower position, so the
/// result is deterministic.
fn cheapest_path(choices: &[Vec<(usize, i32)>]) -> Vec<usize> {
    const POSITIONS: usize = MAX_TAB_FRET as usize;
    // cost[c][p - 1] for the current note; `from[i][c][p - 1]` the previous
    // note's (choice, position) on the cheapest way there.
    let mut cost: Vec<[Option<u32>; POSITIONS]> = Vec::new();
    let mut from: Vec<Vec<[(usize, i32); POSITIONS]>> = Vec::with_capacity(choices.len());
    for (i, notes) in choices.iter().enumerate() {
        // Cheapest way to end the previous note with the hand at each position.
        let best_before: Vec<Option<(u32, usize)>> = (0..POSITIONS)
            .map(|p| {
                cost.iter()
                    .enumerate()
                    .filter_map(|(c, by_position)| by_position[p].map(|v| (v, c)))
                    .min_by_key(|&(v, _)| v)
            })
            .collect();
        let mut next = vec![[None; POSITIONS]; notes.len()];
        let mut back = vec![[(0, 0); POSITIONS]; notes.len()];
        for (c, &(_, fret)) in notes.iter().enumerate() {
            let note_cost = if fret == 0 { 0 } else { FRETTED_COST };
            for p in positions_for(fret) {
                let here = note_cost + HEIGHT_COST * (p - 1) as u32;
                let slot = (p - 1) as usize;
                if i == 0 {
                    next[c][slot] = Some(here);
                    continue;
                }
                let best = best_before
                    .iter()
                    .enumerate()
                    .filter_map(|(q, b)| {
                        let q = q as i32 + 1;
                        b.map(|(v, prev)| (v + shift_cost(q, p), prev, q))
                    })
                    .min_by_key(|&(v, _, _)| v);
                if let Some((v, prev, q)) = best {
                    next[c][slot] = Some(v + here);
                    back[c][slot] = (prev, q);
                }
            }
        }
        cost = next;
        from.push(back);
    }

    // The cheapest end state, then follow the links back.
    let mut end = (0, 1);
    let mut best = u32::MAX;
    for (c, by_position) in cost.iter().enumerate() {
        for (slot, v) in by_position.iter().enumerate() {
            if let Some(v) = *v
                && v < best
            {
                best = v;
                end = (c, slot as i32 + 1);
            }
        }
    }
    let mut path = vec![0; choices.len()];
    let (mut c, mut p) = end;
    for i in (0..choices.len()).rev() {
        path[i] = c;
        (c, p) = from[i][c][(p - 1) as usize];
    }
    path
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pitch::{Letter, Pitch};

    /// (string, fret) pairs, for readable assertions.
    fn tab(instrument: Instrument, midis: &[i32]) -> Vec<(u8, u8)> {
        tablature(instrument, midis)
            .unwrap()
            .positions
            .iter()
            .map(|p| (p.string, p.fret))
            .collect()
    }

    fn sounds(instrument: Instrument, position: TabPosition) -> i32 {
        let strings = instrument.tab_strings().unwrap();
        strings[position.string as usize - 1] + position.fret as i32
    }

    #[test]
    fn c_major_in_first_position_uses_open_strings() {
        // C3 D3 E3 F3 G3 A3 B3 C4, as a guitarist reads them in first position.
        let scale = [48, 50, 52, 53, 55, 57, 59, 60];
        assert_eq!(
            tab(Instrument::Guitar, &scale),
            vec![
                (5, 3),
                (4, 0),
                (4, 2),
                (4, 3),
                (3, 0),
                (3, 2),
                (2, 0),
                (2, 1)
            ]
        );
    }

    #[test]
    fn open_strings_and_string_numbers() {
        // Low E2 is the bottom line (string 6), high E4 the top (string 1).
        assert_eq!(tab(Instrument::Guitar, &[40, 64]), vec![(6, 0), (1, 0)]);
        let bass = tablature(Instrument::BassGuitar, &[28, 43]).unwrap();
        assert_eq!(bass.strings, 4);
        assert_eq!(
            bass.positions,
            vec![
                TabPosition { string: 4, fret: 0 },
                TabPosition { string: 1, fret: 0 }
            ]
        );
    }

    #[test]
    fn high_notes_stay_in_one_position() {
        // C5 B4 A4 G4: fifth position, G4 on the B string rather than a
        // shift down for the E string's 3rd fret.
        assert_eq!(
            tab(Instrument::Guitar, &[72, 71, 69, 67]),
            vec![(1, 8), (1, 7), (1, 5), (2, 8)]
        );
        // Back down to first position once the melody settles there.
        let low_again = [72, 71, 69, 67, 65, 64, 62, 60, 59, 60, 62, 60];
        let result = tab(Instrument::Guitar, &low_again);
        assert_eq!(&result[result.len() - 3..], &[(2, 1), (2, 3), (2, 1)]);
    }

    #[test]
    fn every_position_plays_the_note() {
        for instrument in [Instrument::Guitar, Instrument::BassGuitar] {
            let (low, high) = instrument.written_range();
            let midis: Vec<i32> = (instrument.sounding(low)..=instrument.sounding(high)).collect();
            let result = tablature(instrument, &midis).unwrap();
            for (&midi, &position) in midis.iter().zip(&result.positions) {
                assert_eq!(sounds(instrument, position), midi, "{instrument:?}");
                assert!(i32::from(position.fret) <= MAX_TAB_FRET);
            }
        }
    }

    #[test]
    fn not_fretted_or_out_of_reach() {
        assert_eq!(tablature(Instrument::Violin, &[60]), None);
        assert_eq!(tablature(Instrument::KeyboardTreble, &[60]), None);
        assert_eq!(tablature(Instrument::Guitar, &[39]), None, "below low E");
        assert_eq!(
            tablature(Instrument::Guitar, &[64 + 13]),
            None,
            "past the 12th fret"
        );
        let empty = tablature(Instrument::Guitar, &[]).unwrap();
        assert!(empty.positions.is_empty());
        assert_eq!(empty.strings, 6);
    }

    #[test]
    fn lowest_string_is_the_lowest_note() {
        for instrument in [Instrument::Guitar, Instrument::BassGuitar] {
            let strings = instrument.tab_strings().unwrap();
            assert_eq!(
                *strings.last().unwrap(),
                instrument.sounding(instrument.written_range().0)
            );
            assert!(strings.windows(2).all(|w| w[0] > w[1]), "highest first");
        }
        assert_eq!(
            Instrument::Guitar.sounding(Pitch::natural(Letter::E, 5)),
            Instrument::Guitar.tab_strings().unwrap()[0],
            "the top line is the high E string"
        );
    }
}
