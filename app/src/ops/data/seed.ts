import { BLOCK_DEFAULTS, PLAN_KEYS } from './meta';
import { sortSectors } from './selectors';
import { addDays, sectorItems, toIsoDay } from './tasks';
import type { BlockKey, Blocks, CustomBlock, FileRef, GroupId, OpsData, Person, PlanKey, PlanSlot, PrepStatus, Sector, TaskState } from './types';

/**
 * Demo data from project/JJCon Ops.dc.html: the Jiu-Jitsu Con 2027 sectors, their plans, material
 * lists, steps and the five real people. Dates in the design are written relative to 13 Aug 2027;
 * here they are relative to the time the demo data is created, so "3 days ago" stays 3 days ago.
 */

export const SEED_PEOPLE: Person[] = [
  { id: 'p-diego', name: 'Diego', role: 'Logistics coordinator', email: 'diego@ibjjf.com', active: true },
  { id: 'p-dandre', name: "D'Andre", role: 'Crew coordinator', email: 'jackson@ibjjf.com', active: true },
  { id: 'p-gordo', name: 'Gordo', role: 'Guest services lead', email: 'aleal@ibjjf.com', active: true },
  { id: 'p-daniela', name: 'Daniela', role: 'Rigging and floor lead', email: 'cardoso@ibjjf.com', active: true },
  { id: 'p-marcelo', name: 'Marcelo', role: 'Operations manager', email: 'marcelo@ibjjf.com', active: true }
];

type Row = [string, number, string?];

// id, group, name, owner, lead, location, day (Aug), from, to, build, [mainMat/info status, instr/install status]
const SECTORS: [string, GroupId, string, string, string, string, number, string, string, Sector['build'], PrepStatus, PrepStatus][] = [
  ['store', 'ibjjf', 'IBJJF Store', 'p-diego', 'p-diego', 'Concourse A · 12 × 8 m', 25, '10:00', '16:00', 'none', 'draft', 'ready'],
  ['ent-spec', 'ibjjf', 'Entrance — Spectators', 'p-gordo', 'p-gordo', 'North doors · 14 × 5 m', 24, '09:00', '13:00', 'none', 'draft', 'draft'],
  ['customer', 'ibjjf', 'Customer Service', 'p-marcelo', 'p-dandre', 'Entrance left · 6 × 3 m', 25, '08:00', '10:00', 'complete', 'ready', 'ready'],
  ['seminar', 'ibjjf', 'Seminar Area', 'p-dandre', 'p-dandre', 'Room 204 · 14 × 9 m', 25, '08:00', '12:00', 'none', 'none', 'draft'],
  ['crown', 'ibjjf', 'Crown Booth', 'p-diego', 'p-diego', 'Center aisle · 8 × 8 m', 25, '12:00', '17:00', 'none', 'none', 'none'],
  ['goodie-booth', 'ibjjf', 'Goodie Bag Booth', 'p-diego', 'p-diego', 'Concourse A · 14 × 6 m', 26, '09:00', '15:00', 'none', 'ready', 'ready'],
  ['pod-wm', 'ibjjf', 'Podium World Master', 'p-daniela', 'p-daniela', 'Mat area A · 12 × 6 m', 27, '08:00', '12:00', 'none', 'ready', 'draft'],
  ['pod-jjc', 'ibjjf', 'Podium Jiu-Jitsu Con', 'p-dandre', 'p-dandre', 'Mat area B · 10 × 6 m', 24, '08:00', '11:00', 'progress', 'approved', 'ready'],
  ['ent-bb', 'ibjjf', 'Entrance | Black Belt', '', '', 'East doors · 10 × 4 m', 27, '06:30', '08:00', 'none', 'none', 'none'],
  ['ent-mak', 'ibjjf', 'Entrance — Athletes | Master Adult Kids', 'p-gordo', 'p-marcelo', 'Main doors · 18 × 5 m', 24, '06:00', '09:00', 'none', 'draft', 'none'],
  ['champ-wm', 'ibjjf', 'Championship Master', 'p-daniela', 'p-daniela', 'Main floor · 8 areas, 10 × 10 m', 26, '14:00', '20:00', 'none', 'approved', 'ready'],
  ['champ-jjc', 'ibjjf', 'Championship Jiu-Jitsu Con', 'p-marcelo', 'p-marcelo', 'Main floor · 12 areas, 10 × 10 m', 23, '14:00', '22:00', 'none', 'none', 'none'],
  ['square', 'ibjjf', 'Square', 'p-gordo', 'p-gordo', 'Hall centre · 20 × 20 m', 25, '08:00', '16:00', 'none', 'draft', 'none'],
  ['rooms', 'ibjjf', 'Rooms', 'p-dandre', 'p-dandre', 'Rooms 201–208 · 8 rooms', 25, '07:00', '12:00', 'none', 'ready', 'ready'],
  ['carpet', 'third', 'Carpet', 'p-daniela', 'p-daniela', 'Full floor · 4 200 m²', 24, '06:00', '10:00', 'complete', 'approved', 'ready'],
  ['pipe', 'third', 'Pipe & Drape', 'p-daniela', 'p-daniela', 'Perimeter · 240 m run', 24, '12:00', '18:00', 'progress', 'draft', 'ready'],
  ['bleachers', 'third', 'Bleachers', 'p-dandre', 'p-dandre', 'East side · 1 800 seats', 25, '07:00', '12:00', 'none', 'none', 'draft'],
  ['led', 'third', 'LED Wall', 'p-diego', 'p-diego', 'Mat area + stage · 6 × 3 m', 26, '08:00', '14:00', 'none', 'draft', 'none'],
  ['power', 'third', 'Power Drops', 'p-marcelo', 'p-marcelo', 'Full floor · 30 drops', 24, '06:00', '12:00', 'progress', 'ready', 'approved'],
  ['internet', 'third', 'Internet Drop', 'p-marcelo', 'p-marcelo', 'Full floor · 18 drops', 23, '12:00', '20:00', 'none', 'ready', 'ready'],
  ['truss', 'ops', 'Truss', 'p-daniela', 'p-daniela', 'West Hall roof · 26 hang points', 24, '06:00', '10:00', 'progress', 'none', 'ready'],
  ['truck', 'ops', 'Truck Unload', 'p-marcelo', 'p-marcelo', 'Docks 4–7 · 4 trucks', 24, '05:00', '09:00', 'complete', 'none', 'ready'],
  ['staff', 'ops', 'Staff', 'p-gordo', 'p-gordo', 'Room 112 · 3 shifts, 86 people', 24, '05:30', '06:00', 'complete', 'none', 'approved'],
  ['bagline', 'ops', 'Goodie Bag Assembly Line', 'p-diego', 'p-diego', 'Room 208 · 14 stations, 6 000 bags', 26, '08:00', '14:00', 'none', 'none', 'ready'],
  ['sponsors', 'ops', 'Sponsors', 'p-gordo', 'p-gordo', 'Concourse B · 9 sponsors', 25, '09:00', '17:00', 'progress', 'none', 'approved'],
  ['crates', 'ops', 'Empty Crate Return', 'p-dandre', 'p-dandre', 'Dock 8 · 62 crates', 26, '14:00', '18:00', 'none', 'draft', 'none'],
  ['sponsor-sign', 'ops', 'Sponsor Signage Pack', 'p-gordo', 'p-gordo', 'Hall-wide · 22 pieces', 25, '09:00', '17:00', 'none', 'draft', 'draft']
];

const NO_FLOORPLANS = new Set(['staff', 'sponsors', 'sponsor-sign']);

const BLOCKS_BY: Record<string, Partial<Record<BlockKey, boolean>>> = {
  'pod-wm': { mainMat: true, netMat: true, instr: true },
  'pod-jjc': { mainMat: true, netMat: false, instr: true },
  'ent-bb': { mainMat: false, netMat: false, instr: false },
  'ent-mak': { mainMat: true, netMat: true, instr: true },
  'champ-wm': { mainMat: true, netMat: true, instr: true },
  'champ-jjc': { mainMat: false, netMat: false, instr: false },
  seminar: { mainMat: true, netMat: false, instr: true },
  rooms: { mainMat: true, netMat: true, instr: true },
  square: { mainMat: true, netMat: false, instr: true },
  staff: { link: true },
  crates: { mainMat: true },
  'sponsor-sign': { mainMat: true }
};

/** Block statuses that differ from the sector's main material / instruction status. */
const STATUS_BY: Record<string, Partial<Record<BlockKey, PrepStatus>>> = {
  store: { netMat: 'draft' },
  'champ-wm': { netMat: 'ready' },
  'pod-wm': { netMat: 'none' },
  rooms: { netMat: 'ready' },
  'goodie-booth': { netMat: 'ready' },
  'ent-mak': { netMat: 'draft' },
  customer: { netMat: 'approved' },
  carpet: { info: 'approved', install: 'ready' },
  pipe: { info: 'ready', install: 'ready' },
  bleachers: { info: 'draft', install: 'draft' },
  led: { info: 'draft', install: 'none' },
  power: { info: 'approved', install: 'approved' },
  internet: { info: 'ready', install: 'ready' },
  staff: { link: 'approved' }
};

const REQ_BY: Record<string, string> = {
  store: 'GABCD', 'pod-wm': 'GACD', 'pod-jjc': 'GAC', 'ent-mak': 'ABCD', 'champ-wm': 'GAD', 'ent-spec': 'ABC', customer: 'ABD',
  seminar: 'GAC', crown: 'GABCD', carpet: 'GA', pipe: 'GA', bleachers: 'GAD', led: 'GABD', power: 'GD',
  truss: 'GC', truck: 'G', bagline: 'G', crates: 'A'
};

const FP_BY: Record<string, Partial<Record<PlanKey, PrepStatus>>> = {
  store: { G: 'approved', A: 'approved', B: 'draft', C: 'ready', D: 'none' },
  'pod-wm': { G: 'approved', A: 'ready', C: 'draft', D: 'none' },
  'pod-jjc': { G: 'approved', A: 'approved', C: 'ready' },
  'ent-mak': { A: 'ready', B: 'draft', C: 'none', D: 'ready' },
  'champ-wm': { G: 'approved', A: 'ready', D: 'draft' },
  'ent-spec': { A: 'ready', B: 'draft', C: 'ready' },
  customer: { A: 'approved', B: 'approved', D: 'approved' },
  seminar: { G: 'draft', A: 'draft', C: 'none' },
  carpet: { G: 'approved', A: 'approved' },
  pipe: { G: 'ready', A: 'ready' },
  bleachers: { G: 'approved', A: 'ready', D: 'none' },
  led: { G: 'draft', A: 'draft', B: 'none', D: 'none' },
  power: { G: 'ready', D: 'approved' },
  truss: { G: 'approved', C: 'ready' },
  truck: { G: 'approved' },
  bagline: { G: 'approved' },
  crates: { A: 'draft' }
};

// Named files from the design: [name, MB, uploaded days ago, pages, replaced file's days ago]
const FILE_BY: Record<string, [string, number, number, number, number?]> = {
  'pod-jjc-A': ['JJC27-PODIUM-JJC-furniture-r2.pdf', 1.3, 3, 1],
  'champ-wm-G': ['WM27-CHAMP-general-layout-r1.pdf', 3.4, 2, 2],
  'power-D': ['JJC27-HALL-power-drops-r6.pdf', 3.8, 0, 2, 23],
  'carpet-A': ['JJC27-CARPET-zones-r1.pdf', 2.9, 5, 1],
  'truss-G': ['JJC27-TRUSS-general-layout-r3.pdf', 4.1, 1, 2, 14],
  'carpet-G': ['JJC27-CARPET-general-layout-r2.pdf', 2.2, 4, 1],
  'pod-jjc-G': ['JJC27-PODIUM-JJC-general-layout-r1.pdf', 1.1, 3, 1],
  'pod-wm-G': ['WM27-PODIUM-general-layout-r1.pdf', 1.2, 1, 1]
};
const FILE_TAG: Record<PlanKey, string> = { G: 'general-layout', A: 'furniture', B: 'network', C: 'banners', D: 'power' };

const MATS: Record<string, [string, Row[]][]> = {
  'pod-wm': [['Main materials', [['Podium steps, 4 piece', 1, 'Fourth step for tied bronze, bolted at the right'], ['Medal tables, 6 ft', 3], ['Medal trays', 12, 'By belt: blue, purple, brown, black'], ['Backdrop frame, 5 × 3 m', 1], ['Backdrop print, World Master 2027', 1], ['Flag stands', 3], ['Photographer riser', 1]]], ['Computers & network', [['Results screen, 55 in', 1], ['Results laptop', 1], ['Network switch, 8 port', 1, 'Not yet confirmed with the venue IT desk']]]],
  'pod-jjc': [['Main materials', [['Podium steps, 3 piece', 1, 'Bolt steps 1 to 3 together'], ['Medal tables, 6 ft', 2], ['Medal trays', 9], ['Backdrop frame, 4 × 3 m', 1], ['Backdrop print, Jiu-Jitsu Con 2027', 1], ['Floor tape, gold', 2]]]],
  'ent-mak': [['Main materials', [['Lane dividers, 2 m', 14], ['Scan tables, 4 ft', 4], ['Operator chairs', 4], ['Wristband bins, by division', 6, 'Master, Adult and Kids, two each'], ['Guardian check sign', 2], ['Stanchions with belt', 10]]], ['Computers & network', [['Scanning handhelds', 6], ['Charging dock, 6 bay', 1], ['Wristband printers', 2]]]],
  'champ-wm': [['Main materials', [['Competition mats, 10 × 10 m', 8], ['Mat tape, 50 m rolls', 16], ['Mat edge trim, 3 m', 32], ['Referee chairs', 8], ['Coach chairs', 16], ['Athlete benches', 16], ['Scoreboard stands', 8]]], ['Computers & network', [['Mat control laptops', 8], ['Scoreboard displays, 32 in', 8], ['Bracket printer', 2], ['Network switch, 16 port', 1]]]],
  customer: [['Main materials', [['Service desk, 6 ft', 2], ['Operator chairs', 4], ['Lost property bins', 2], ['Desk sign', 1]]], ['Computers & network', [['Service laptops', 2], ['Receipt printer', 1], ['Power strip, 6 outlet', 1]]]],
  carpet: [['Main materials', [['Carpet rolls, 4 m × 30 m', 14], ['Carpet tape, 50 m', 40], ['Edge trim, 3 m', 26], ['Utility knives', 6], ['Knee kickers', 4]]]],
  power: [['Main materials', [['Floor drops, 32 A', 12], ['Distro boxes', 6], ['Extension cords, 15 m', 10], ['Cable ramps, 1 m', 24], ['Cable ties, 100 pack', 8]]], ['Computers & network', [['Load test meter', 1], ['Drop labels, printed set', 1]]]],
  'goodie-booth': [['Main materials', [['Distribution counters, 6 ft', 4], ['Counter skirts, IBJJF blue', 4], ['Filled-bag pallets', 6, 'Delivered from the assembly line, two per counter pair'], ['Operator chairs', 4], ['Queue stanchions', 8, 'Chrome, black belt'], ['Retractable belts, 3 m', 8], ['Overhead sign, 3 m', 1], ['Waste bins with liners', 2]]], ['Computers & network', [['Scan tablets', 4, 'Asset tags JJC-210 to 213'], ['Wifi access point', 1], ['Power strips, 6 outlet', 2], ['Cat6 runs, 15 m', 2]]]],
  rooms: [['Main materials', [['Folding tables, 6 ft', 16], ['Stacking chairs', 120], ['Room name cards', 8], ['Whiteboards with markers', 4], ['Waste bins with liners', 8], ['Water stations', 4]]], ['Computers & network', [['Projector kits', 4, 'Rooms 202, 204, 206 and 208'], ['Presenter laptops', 2], ['Wifi access points', 8], ['Power strips, 6 outlet', 16]]]],
  crates: [['Main materials', [['Four-wheel dollies', 8], ['Load straps', 12], ['Crate labels, printed set', 1]]]]
};

const STEPS: Record<string, string[]> = {
  store: ['Set the six display tables in a U, opening to the main aisle.', 'Build the three tills behind the display line.', 'Patch each till to the network drop at the rear wall.', 'Hang both banners, bottom edge at 2.4 m.', 'Stock the display tables from the pallets, largest sizes at the back.'],
  'pod-wm': ['Bolt the four podium steps together, fourth step at the right, and level them on the mat.', 'Set the backdrop frame 1.5 m behind the podium, centred on the photographer riser.', 'Place the three medal tables stage right, trays in belt order.'],
  'pod-jjc': ['Bolt the three podium steps together and level them on the mat.', 'Set the backdrop frame 1.5 m behind the podium, centred.', 'Place the two medal tables stage right, trays in order.', 'Tape the athlete walk-on line in gold from the tunnel to step 1.', 'Stand on each step before handover. Nothing should rock.'],
  'champ-wm': ['The World Master floor is built on the Jiu-Jitsu Con floor. Lift areas 9 to 12 first, then re-tape 1 to 8.', 'Re-mark areas 1 to 8 as World Master areas and swap the area signage.', 'Set one mat control table per area, laptop and scoreboard facing the referee.', 'Patch every control laptop to the floor switch and run a test bracket on each area.', 'Walk every seam before handover. No gap wider than a finger.'],
  customer: ['Set both desks facing the entrance aisle.', 'Patch the two laptops to the wall drop and test the ticket system.', 'Stock the lost property bins under desk two.', 'Hang the desk sign at 2.2 m.'],
  carpet: ['Sweep the slab and mark the six zone boundaries with tape.', 'Roll carpet zone by zone, starting at the north wall.', 'Tape every seam on both edges. No loose edge in a walkway.', 'Fit edge trim on all aisle transitions.'],
  pipe: ['Set base plates every 3 m along the marked perimeter.', 'Raise uprights and level before any drape goes on.', 'Hang drape at 3 m, pleats facing the public side.', 'Tie back the two service gaps marked on the plan.'],
  power: ['Confirm the twelve drop positions against the plan before pulling cable.', 'Set distro boxes at drops 2, 5 and 9.', 'Run extension cords to the sector tables, cable ramps on every crossing.', 'Label both ends of every cord with its drop number.', 'Load test each drop and record the reading.'],
  truss: ['Verify all 26 hang points against the certified rigging plan before anything is lifted.', 'Fit span sets and safety steels at every point.', 'Lay the truss sections out on the deck under their own points.', 'Attach the mat banners to the truss before it goes up. Never at height.', 'Raise to 6 m in one pass, all points together.', 'Check banner alignment from the bleacher side and lock off.', 'Sign the rig off with the venue rigger before any further load goes up.'],
  truck: ['Stage the four bays before the first truck backs in.', 'Unload bay by bay, sector labels facing out.', 'Move each crate straight to its sector. Nothing is stored on the dock.', 'Clear the dock plate area after every truck.', 'Log each truck off against the manifest as it leaves.'],
  staff: ['Collect the badge stock and lanyards from the set up desk.', 'Set the three check-in tables along the room 112 wall.', 'Open the check-in sheet and confirm the shift list against the roster.', 'Brief the two desk staff on the check-out cut-off.', 'Check every shift out on the sheet. Payroll works from that record alone.'],
  'goodie-booth': ['Set the four distribution counters in a straight line, 1.2 m apart, facing the concourse.', 'Skirt every counter front, pleats facing the public side.', 'Stage two pallets of filled bags behind each pair of counters. Nothing in the queue lane.', 'Patch the four scan tablets to the access point and test one pick-up end to end.', 'Hang the overhead sign at 2.6 m, centred on counters two and three.', 'Run the queue as a single serpentine, eight posts, belts at half tension.', 'Call room 208 for a pallet refill at two pallets remaining. Do not let a counter run empty.'],
  rooms: ['Collect the key set for rooms 201 to 208 from the venue office.', 'Set each room to its sheet: table count, chair count and layout.', 'Fit the room name card in the holder outside each door.', 'Build the projector kits in 202, 204, 206 and 208 and test the laptop feed.', 'Place a water station on each landing, two per side.', 'Photograph each finished room and mark it complete on the phone.'],
  internet: ['Confirm the eighteen drop positions against the plan before pulling cable.', 'Pull from the hall MDF, one run per drop, and label both ends with the drop number.', 'Terminate and test each drop with the house IT technician present.', 'Mount the twelve access points at 3 m. Never on a table or a counter.', 'Bring the event SSID live and walk the hall for coverage gaps.', 'Log the speed test for every drop on work order 4471.'],
  bagline: ['Set the fourteen stations in two rows of seven, 1.5 m apart, with a clear 2 m run-out at the end of each row.', 'Place the bag cartons and the content pallets at the head of each row. Nothing in the walkway.', 'Load each station with one item type only, in the order the content list is printed.', 'Staff the line with 28 volunteers, two per station, plus one runner per row and one counter at the end.', 'Run ten bags as a test and check the item count against the content list before the line starts.', 'Start the line at 08:00. Target is 500 bags an hour, 6 000 bags by 20:00 on 26 Aug.', 'Break the line 12:00 to 12:30. The second shift takes over at 14:00.', 'Shrink-wrap each finished pallet at 250 bags and mark the count sheet.', 'Move finished pallets to the Goodie Bag Booth from 07:00 on 26 Aug, six pallets per run.', 'All 6 000 bags must be assembled and at the booth before doors at 09:00 on 26 Aug.'],
  sponsors: ['Drop each boxed kit at its booth number before sponsors arrive.', 'Build the counter unit and fit the branding panels at all nine booths.', 'Leave the kit instruction sheet on the counter.', 'Confirm power at every booth with the sponsor lead.', 'Walk the nine booths with the sponsor lead before doors.'],
  crates: ['Collect empties sector by sector from 14:00.', 'Stack by sector at dock 8, labels facing out.', 'Hand the count to the venue before the last truck leaves.']
};

const INFO: Record<string, [string, string][]> = {
  carpet: [['Supplier', 'Vegas Expo Floors'], ['Product', 'Event carpet, 4 m roll, navy'], ['Coverage', '4 200 m² over six zones'], ['Underlay', 'None. Direct to slab'], ['Removal', '27 Aug from 20:00']],
  pipe: [['Supplier', 'West Hall house stock'], ['Drape height', '3 m, navy IFR'], ['Run length', '240 m perimeter'], ['Service gaps', 'Two, marked on plan'], ['Return', 'Dock 8, 27 Aug']],
  bleachers: [['Supplier', 'Nevada Seating Co'], ['Capacity', '1 800 seats, four banks'], ['Inspection', 'Venue engineer, 25 Aug 12:00'], ['Access', 'Stair units both ends'], ['Load limit', 'Posted at each bank']],
  led: [['Supplier', 'Silverline AV'], ['Wall size', '6 × 3 m, 3.9 mm pitch'], ['Feed', 'SDI from mat control'], ['Power', 'Two 32 A drops, stage left'], ['Spares', 'Six panels on site']],
  power: [['Supplier', 'West Hall electrical'], ['Drops', '12 floor drops, 32 A'], ['Distro', 'Six boxes, drops 2, 5 and 9'], ['Test', 'Load reading logged per drop'], ['Contact', 'House electrician, channel 5']],
  internet: [['Supplier', 'LVCC Network Services'], ['Wired drops', '18 drops, 1 Gb, work order 4471'], ['Wireless', '12 access points, SSID JJCON-2027'], ['Uplink', '500 Mb symmetrical from the hall MDF'], ['Cut-over', '23 Aug 20:00, tested per drop'], ['Support', 'House IT desk, radio channel 7']]
};

/** Material rows already confirmed on site ('all' or the first n), and steps done. */
const CHECKED: Record<string, number | 'all'> = { 'goodie-booth': 5, rooms: 4, 'pod-jjc': 7, customer: 'all', carpet: 'all', power: 8, bagline: 4 };
const DONE: Record<string, number | 'all'> = { 'pod-jjc': 2, customer: 'all', carpet: 'all', power: 3, truss: 4, truck: 'all', staff: 'all', sponsors: 1 };

// Packet printed n days ago; content last changed 0 days ago. A packet printed today matches.
const PRINTED: Record<string, number> = { 'pod-jjc': 0, carpet: 0, power: 3, truck: 0, truss: 1, customer: 0, staff: 2 };

const XREF: Record<string, Sector['xref']> = {
  'goodie-booth': { sectorId: 'bagline', text: 'Bags are filled at the', tail: ' in room 208. This page is the booth build only.' },
  bagline: { sectorId: 'goodie-booth', text: 'Filled bags are handed out at the', tail: ' on Concourse A. This page is the assembly operation only.' }
};

const ARCHIVED: Record<string, [number, string, string]> = {
  'sponsor-sign': [9, 'p-gordo', 'Signage folded into the sponsor booth kits for 2027'],
  crates: [4, 'p-marcelo', 'Venue is handling crate return this year']
};

// Task overrides from the design: unassigned items, a reassigned plan, and delay notes [days ago, by].
const TASK_WHO: Record<string, string> = { 'ent-mak:C': '', 'pod-wm:netMat': '', 'champ-wm:D': '', 'truss:C': 'p-gordo' };
const TASK_NOTES: Record<string, [string, number, string]> = {
  'store:netMat': ['Waiting on the till vendor for the network spec. Promised by Monday.', 3, 'p-marcelo'],
  'ent-mak:B': ['Scanner count went from 4 to 6. The plan is being redrawn.', 2, 'p-gordo'],
  'bleachers:info': ['Bleacher supplier moved delivery to the 22nd.', 4, 'p-dandre']
};

/**
 * Deadlines from the design, which was dated 13 Aug 2027: each item is due its lead time before
 * the build day, nudged a couple of days per sector. Shifted so 13 Aug lands on today, which keeps
 * the overdue and due-soon states in the demo.
 */
function seedTasks(sectors: Sector[], now: Date) {
  const today = toIsoDay(now);
  sortSectors(sectors.filter((s) => !s.archived)).forEach((s, xi) => {
    const jitter = (xi % 5) - 2;
    const buildDay = Number(s.day.slice(8, 10));
    s.tasks = {};
    sectorItems(s).forEach((it) => {
      const k = `${s.id}:${it.slot}`;
      const t: TaskState = { due: addDays(today, buildDay - it.offset + jitter - 13) };
      if (TASK_WHO[k] !== undefined) t.who = TASK_WHO[k];
      const n = TASK_NOTES[k];
      if (n) t.note = { text: n[0], by: n[2], at: new Date(now.getTime() - n[1] * 86_400_000).toISOString() };
      s.tasks![it.slot] = t;
    });
  });
}

export function seedData(now = new Date()): OpsData {
  const DAY = 86_400_000;
  const ago = (d: number) => new Date(now.getTime() - d * DAY).toISOString();
  const eventDay = (aug: number) => `2027-08-${String(aug).padStart(2, '0')}`;
  let n = 0;
  const uid = (p: string) => `${p}-${(n++).toString(36)}`;

  const tick = (count: number | 'all' | undefined, i: number) => count === 'all' || (count !== undefined && i < count);

  const sectors: Sector[] = SECTORS.map(([id, group, name, ownerId, leadId, location, day, from, to, build, m, i]) => {
      const on = { mainMat: false, netMat: false, instr: false, info: false, install: false, link: false, ...BLOCK_DEFAULTS[group], ...BLOCKS_BY[id] };
      const st = (k: BlockKey): PrepStatus => STATUS_BY[id]?.[k] ?? (k === 'instr' || k === 'install' ? i : k === 'link' ? 'approved' : m);

      let flat = 0;
      const matRows = (net: boolean) =>
        (MATS[id] ?? []).filter(([g]) => /network/i.test(g) === net).flatMap(([, rows]) => rows)
          .map(([item, qty, note]) => ({ id: uid('m'), item, qty, note, checked: tick(CHECKED[id], flat++) }));
      const main = matRows(false);
      const net = matRows(true);
      const steps = (STEPS[id] ?? []).map((text, k) => ({ id: uid('s'), text, done: tick(DONE[id], k) }));
      const stepsAreInstall = on.install && !on.instr;

      const blocks: Blocks = {
        mainMat: { on: on.mainMat, status: st('mainMat'), rows: main },
        netMat: { on: on.netMat, status: st('netMat'), rows: net },
        instr: { on: on.instr, status: st('instr'), steps: stepsAreInstall ? [] : steps },
        install: { on: on.install, status: st('install'), steps: stepsAreInstall ? steps : [] },
        info: { on: on.info, status: st('info'), rows: (INFO[id] ?? []).map(([label, value]) => ({ id: uid('i'), label, value })) },
        link: id === 'staff'
          ? { on: true, status: st('link'), label: 'Staff check-in / check-out sheet · Google Sheets', url: 'https://docs.google.com/spreadsheets' }
          : { on: on.link, status: 'none', label: '', url: '' }
      };

      const req = REQ_BY[id] ?? '';
      const plans = Object.fromEntries(PLAN_KEYS.map((k) => {
        const required = req.includes(k);
        const status: PrepStatus = FP_BY[id]?.[k] ?? 'none';
        const slot: PlanSlot = { required };
        if (required && (status === 'ready' || status === 'approved')) {
          const named = FILE_BY[`${id}-${k}`];
          const file: FileRef = named
            ? { id: `sample:${id}:${k}`, name: named[0], size: Math.round(named[1] * 1_048_576), pages: named[3], uploadedAt: ago(named[2]), uploadedBy: ownerId || null }
            : { id: `sample:${id}:${k}`, name: `JJC27-${id.toUpperCase().replace(/[^A-Z0-9]/g, '-')}-${FILE_TAG[k]}-r1.pdf`, size: 1_258_291, pages: 1, uploadedAt: ago(0), uploadedBy: ownerId || null };
          slot.file = file;
          if (named?.[4] !== undefined) slot.prevUploadedAt = ago(named[4]);
        }
        return [k, slot];
      })) as Record<PlanKey, PlanSlot>;

      const custom: CustomBlock[] = [];
      if (id === 'truss') {
        custom.push({ id: 'truss-refs', kind: 'gallery', name: 'Reference images', status: 'approved', on: true,
          shots: [['Truss built, 2026 edition', 'Mat signage hung at 6 m'], ['Banner alignment', 'Seen from the bleacher side'], ['Hang point detail', 'Sling and shackle, correct dressing']]
            .map(([title, caption]) => ({ id: uid('g'), title, caption })) });
      }
      if (id === 'bagline') {
        custom.push({ id: 'bag-contents', kind: 'checklist', name: 'Bag contents', status: 'ready', on: true, foot: 'Quantities are per bag. Totals assume 6 000 bags.',
          rows: ([['Event programme', 1, '6 000 total'], ['Sponsor flyer set', 3, '18 000 total, three sponsors'], ['Sticker sheet', 1, '6 000 total'], ['Supplement sample sachet', 2, '12 000 total'], ['Branded microfibre towel', 1, '6 000 total'], ['Water bottle, 600 ml', 1, '6 000 total'], ['Discount card, IBJJF Store', 1, '6 000 total']] as Row[])
            .map(([item, qty, note], k) => ({ id: uid('c'), item, qty, note, checked: tick(CHECKED[id], k) })) });
      }

      const sector: Sector = {
        id, name, group, ownerId, leadId, location, day: eventDay(day), from, to, build,
        plans, blocks, custom,
        contentChangedAt: ago(0.1),
        ...(NO_FLOORPLANS.has(id) ? { noFloorplans: true } : {}),
        ...(XREF[id] ? { xref: XREF[id] } : {}),
        ...(PRINTED[id] !== undefined ? { packetPrintedAt: PRINTED[id] === 0 ? ago(0.05) : ago(PRINTED[id]) } : {})
      };
      const arch = ARCHIVED[id];
      if (arch) sector.archived = { at: ago(arch[0]), by: arch[1], reason: arch[2] };
      return sector;
    });
  seedTasks(sectors, now);
  // The last 09:00 before now: the time the office's weekly snapshot was taken.
  const nine = new Date(now); nine.setHours(9, 0, 0, 0);
  if (nine > now) nine.setDate(nine.getDate() - 1);
  return { version: 1, people: SEED_PEOPLE.map((p) => ({ ...p })), sectors, tasksUpdated: { at: nine.toISOString(), by: 'p-marcelo' } };
}

/**
 * What the design draws inside each sector's sample floorplan PDF.
 * Real floorplans are uploaded PDFs; these only stand in for them in the demo data.
 */
export interface SheetSpec {
  kind: 'line' | 'grid' | 'counter';
  stations?: number; st?: string; stW?: number; stH?: number;
  tables?: number; tb?: string; chairs?: number; stanch?: number;
  bl?: string[]; power?: number; cords?: number; network?: number;
}

export const SHEET_SPECS: Record<string, SheetSpec> = {
  store: { kind: 'counter', stations: 3, st: 'TILL', stH: 96, tables: 6, tb: 'DISPLAY ', chairs: 4, stanch: 6, bl: ['BANNER — IBJJF STORE', 'BANNER — 2027 KIT'], power: 3, cords: 3, network: 2 },
  'pod-wm': { kind: 'line', stations: 4, st: 'STEP', stW: 150, stH: 130, tables: 3, tb: 'MEDAL ', chairs: 4, bl: ['BACKDROP — WORLD MASTER 2027'], power: 2, cords: 2, network: 2 },
  'pod-jjc': { kind: 'line', stations: 3, st: 'STEP', stW: 150, stH: 130, tables: 2, tb: 'MEDAL ', bl: ['BACKDROP — JIU-JITSU CON 2027'], power: 2, cords: 2, network: 1 },
  'ent-mak': { kind: 'line', stations: 6, st: 'LANE', stW: 100, stH: 200, tables: 4, tb: 'SCAN ', chairs: 4, stanch: 10, bl: ['MASTER · ADULT', 'KIDS — WITH GUARDIAN'], power: 3, cords: 3, network: 4 },
  'champ-wm': { kind: 'grid', stations: 8, st: 'AREA', stH: 104, tables: 3, tb: 'CONTROL ', chairs: 8, bl: ['WORLD MASTER — AREAS 1–4', 'WORLD MASTER — AREAS 5–8'], power: 4, cords: 4, network: 3 },
  'ent-spec': { kind: 'line', stations: 4, st: 'LANE', stW: 130, stH: 200, tables: 3, tb: 'SCAN ', chairs: 3, stanch: 7, bl: ['BANNER — SPECTATOR ENTRANCE', 'BANNER — TICKETS'], power: 2, cords: 2, network: 2 },
  customer: { kind: 'counter', stations: 2, st: 'DESK', stH: 96, tables: 2, tb: 'T', chairs: 4, stanch: 4, bl: ['BANNER — CUSTOMER SERVICE'], power: 2, cords: 2, network: 2 },
  carpet: { kind: 'line', stations: 6, st: 'ZONE', stW: 120, stH: 290 },
  pipe: { kind: 'line', stations: 8, st: 'RUN', stW: 86, stH: 70 },
  bleachers: { kind: 'line', stations: 4, st: 'BANK', stW: 170, stH: 250, power: 2, cords: 2 },
  power: { kind: 'line', stations: 6, st: 'ZONE', stW: 120, stH: 200, power: 12, cords: 10 },
  truss: { kind: 'grid', stations: 14, st: 'HP', stH: 70, bl: ['TRUSS BANNER — MAT 1–6', 'TRUSS BANNER — MAT 7–12'] },
  truck: { kind: 'line', stations: 4, st: 'BAY', stW: 170, stH: 250, tables: 2, tb: 'STAGE ' },
  bagline: { kind: 'grid', stations: 14, st: 'ST', stH: 80, tables: 4, tb: 'PALLET ', power: 4, cords: 4 },
  'goodie-booth': { kind: 'counter', stations: 4, st: 'GIVE', stH: 96, tables: 4, tb: 'PALLET ', chairs: 4, stanch: 8, bl: ['BANNER — GOODIE BAG PICK-UP'], power: 2, cords: 2, network: 2 },
  square: { kind: 'counter', stations: 4, st: 'ZONE', stH: 104, tables: 6, tb: 'HIGH-TOP ', chairs: 8, stanch: 6, bl: ['BANNER — THE SQUARE'], power: 3, cords: 3, network: 2 },
  rooms: { kind: 'grid', stations: 8, st: 'ROOM 20', stH: 88, tables: 6, tb: 'TABLE ', chairs: 10, power: 4, cords: 4, network: 4 },
  internet: { kind: 'line', stations: 9, st: 'DROP', stW: 76, stH: 64, power: 3, cords: 3, network: 6 },
  crates: { kind: 'line', stations: 4, st: 'STACK', stW: 150, stH: 200 }
};

/** Second-page titles for the two-page sample files. */
export const SHEET_DETAIL: Record<string, string> = {
  'champ-wm-G': 'Areas 9–12 lift sequence',
  'power-D': 'Distro box schedule',
  'truss-G': 'Hang point coordinates'
};
