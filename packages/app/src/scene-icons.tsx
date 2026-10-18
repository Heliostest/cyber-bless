import type { ReactNode } from "react";
import { Icon } from "./art";

/**
 * Drawn scene icons, keyed by scene id, so a scene looks the same on 今日, 心愿
 * and 场景目录. Flat cel fills with one shade band, then the ink line on top, in the
 * ink colour the 3D scenes' toon pass draws (0x584235). No emoji or Unicode
 * symbols: they render differently on every platform.
 */
const INK = "#584235";

/** A cel part: a flat fill, its shade/highlight shapes, then its ink line. */
function Part({
  d,
  fill,
  evenodd = false,
  children,
}: {
  d: string;
  fill: string;
  evenodd?: boolean;
  children?: ReactNode;
}) {
  const rule = evenodd ? "evenodd" : undefined;
  return (
    <>
      <path d={d} fill={fill} fillRule={rule} />
      {children}
      <path d={d} fill="none" stroke={INK} strokeWidth={2.2} />
    </>
  );
}

/** An inked stroke with a coloured core (cords, twigs, ribbons). */
function Cord({ d, color, width = 2 }: { d: string; color: string; width?: number }) {
  return (
    <>
      <path d={d} fill="none" stroke={INK} strokeWidth={width + 2.2} />
      <path d={d} fill="none" stroke={color} strokeWidth={width} />
    </>
  );
}

const sceneIcons: Record<string, ReactNode> = {
  'paper-pinwheel': (<>
    <path d="M32 30V58" stroke="#a18158" strokeWidth="5" strokeLinecap="round"/>
    <path d="M31 29L10 11Q39 5 34 28Z M33 31L54 49Q25 55 30 32Z" fill="#e5947a" stroke="#b36e58" strokeWidth="1"/>
    <path d="M30 31L12 52Q5 24 28 28Z M34 29L52 8Q59 36 36 32Z" fill="#6bbcaf" stroke="#448d83" strokeWidth="1"/>
    <circle cx="32" cy="30" r="5" fill="#e7c17d" stroke="#a18158"/>
  </>),
  'chinese-steelyard': (<>
    <path d="M8 25L57 20" stroke="#956b40" strokeWidth="5" strokeLinecap="round"/>
    <circle cx="25" cy="17" r="6" fill="none" stroke="#bc995f" strokeWidth="3"/>
    <path d="M13 26L6 45H26L13 26M46 22V37" fill="none" stroke="#c9b98a" strokeWidth="2"/>
    <path d="M5 45Q16 56 27 45Z" fill="#bc995f"/><path d="M42 37H50L54 49H38Z" fill="#8b6d4b"/>
    <circle cx="16" cy="43" r="5" fill="#e5a64f"/>
  </>),
  'garden-croquet': (<>
    <path d="M43 49V25H57V49" fill="none" stroke="#9faba0" strokeWidth="5" strokeLinejoin="round"/>
    <path d="M16 10V47" stroke="#765334" strokeWidth="4" strokeLinecap="round"/>
    <path d="M7 43H25V53H7Z" fill="#bb8b52" stroke="#765334" strokeWidth="2"/>
    <circle cx="35" cy="49" r="7" fill="#ce6651"/><path d="M29 47H41" stroke="#fff0cd" strokeWidth="3"/>
    <path d="M5 57H59" stroke="#8fae57" strokeWidth="4" strokeLinecap="round"/>
  </>),
  'welsh-drop-spindle': (<>
    <path d="M32 9V50" stroke="#b88746" strokeWidth="4" strokeLinecap="round"/>
    <path d="M32 8V16" stroke="#d8cbbb" strokeWidth="2"/>
    <path d="M26 20Q32 16 38 20L36 34H28Z" fill="#eee6d5" stroke="#b9ad99" strokeWidth="2"/>
    <ellipse cx="32" cy="41" rx="19" ry="6" fill="#c39452" stroke="#795735" strokeWidth="2"/>
    <path d="M22 24H41M24 29H39" stroke="#d8cbbb" strokeWidth="2"/>
    <circle cx="31" cy="7" r="5" fill="#eee6d5"/>
  </>),
  'scottish-plunge-churn': (<>
    <path d="M21 24H43L47 56H17Z" fill="#b9905c" stroke="#725037" strokeWidth="2"/>
    <path d="M21 33H43M19 47H45" stroke="#616d6a" strokeWidth="5"/>
    <ellipse cx="32" cy="24" rx="12" ry="4" fill="#d2b582" stroke="#725037" strokeWidth="2"/>
    <path d="M32 9V25" stroke="#d2b582" strokeWidth="4"/><path d="M32 6V12" stroke="#725037" strokeWidth="7" strokeLinecap="round"/>
  </>),
  'irish-bodhran': (<>
    <ellipse cx="31" cy="35" rx="24" ry="25" fill="#af7d4a" stroke="#714b34" strokeWidth="2"/>
    <ellipse cx="29" cy="33" rx="20" ry="22" fill="#ead4a4" stroke="#497363" strokeWidth="4"/>
    <path d="M15 25L46 38" stroke="#cfaa74" strokeWidth="4" strokeLinecap="round"/>
    <circle cx="14" cy="25" r="5" fill="#714b34"/><circle cx="47" cy="38" r="5" fill="#714b34"/>
  </>),
  'french-coffee-mill': (<>
    <path d="M12 33H51V58H12Z" fill="#b17b45" stroke="#765238" strokeWidth="2"/><path d="M18 42H45V55H18Z" fill="#d5b27b" stroke="#765238" strokeWidth="2"/>
    <path d="M15 22H48L41 34H23Z" fill="#b7a26b" stroke="#7e9699" strokeWidth="2"/>
    <path d="M31 25V14H50" fill="none" stroke="#7e9699" strokeWidth="4" strokeLinejoin="round"/><path d="M51 8V20" stroke="#577c67" strokeWidth="7" strokeLinecap="round"/>
    <circle cx="31" cy="48" r="4" fill="#577c67"/>
  </>),
  'japanese-wagasa': (<>
    <path d="M32 5L5 27Q32 43 59 27Z" fill="#d76b54" stroke="#9e5843" strokeWidth="2"/>
    <path d="M32 5L21 35L32 38L40 36Z" fill="#f5dfb8"/>
    <path d="M32 5L13 31M32 5L25 36M32 5L46 33M32 5V57" fill="none" stroke="#b9874c" strokeWidth="2"/>
    <path d="M32 48V58" stroke="#5f6e53" strokeWidth="5" strokeLinecap="round"/>
  </>),
  'spanish-castanets': (<>
    <path d="M17 16Q11 5 22 9L41 9Q52 5 47 16" fill="none" stroke="#29665f" strokeWidth="3"/>
    <ellipse cx="20" cy="40" rx="15" ry="18" fill="#8f5037" stroke="#d8b383" strokeWidth="3"/><ellipse cx="20" cy="31" rx="14" ry="18" fill="#b87945" stroke="#81482f" strokeWidth="2"/>
    <ellipse cx="46" cy="41" rx="13" ry="16" fill="#8f5037" stroke="#d8b383" strokeWidth="3"/><ellipse cx="46" cy="32" rx="12" ry="16" fill="#c18b55" stroke="#81482f" strokeWidth="2"/>
    <path d="M14 23Q19 18 25 23M41 24Q46 20 50 25" fill="none" stroke="#ddb88b" strokeWidth="2"/>
  </>),
  'japanese-shishi-odoshi': (<>
    <ellipse cx="31" cy="49" rx="25" ry="10" fill="#a9d6cd" stroke="#8c9a98" strokeWidth="5"/>
    <path d="M27 46V22M37 46V22" stroke="#788342" strokeWidth="5"/>
    <path d="M12 27L49 17L51 24L14 34Z" fill="#b0b86d" stroke="#788342" strokeWidth="2"/>
    <ellipse cx="49" cy="20" rx="3" ry="4" fill="#e5d9a2"/><path d="M49 26V40" stroke="#6fbfc3" strokeWidth="3"/>
    <path d="M17 44Q9 37 6 46" fill="#8c9a98"/>
  </>),
  'german-jumping-jack': (<>
    <path d="M20 26L12 40M44 26L52 40M27 43L20 55M37 43L44 55" stroke="#537b97" strokeWidth="7" strokeLinecap="round"/>
    <path d="M23 24H41L39 44H25Z" fill="#55a7a0" stroke="#3f7b76" strokeWidth="2"/>
    <circle cx="32" cy="16" r="8" fill="#ecc999"/>
    <path d="M23 11H41L37 3H27Z" fill="#d77d42"/>
    <path d="M32 45V57" stroke="#b5986b" strokeWidth="2"/><circle cx="32" cy="59" r="3" fill="#d8b584"/>
    <circle cx="29" cy="16" r="1" fill="#4d4a40"/><circle cx="35" cy="16" r="1" fill="#4d4a40"/>
  </>),
  'finnish-kantele': (<>
    <path d="M8 18L55 14L55 49L21 51Z" fill="#d8b178" stroke="#9e734b" strokeWidth="3"/>
    <circle cx="38" cy="47" r="2.5" fill="#815c3f"/>
    <path d="M15 22L50 20M17 28L50 26M19 34L50 32M21 40L50 38M23 46L50 44" stroke="#7f9696" strokeWidth="1.5"/>
    <path d="M50 18V47" stroke="#647f7d" strokeWidth="3"/>
    <path d="M12 20L22 47" stroke="#a98258" strokeWidth="4" strokeDasharray="2 4"/>
  </>),
  'estonian-village-swing': (<>
    <path d="M5 53L14 9L24 53M40 53L50 9L59 53" fill="none" stroke="#a98258" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9 10H55" stroke="#bd925e" strokeWidth="6" strokeLinecap="round"/>
    <path d="M24 14L20 43M43 14L39 43" stroke="#c7a16c" strokeWidth="4"/>
    <path d="M16 40L43 38L46 44L19 47Z" fill="#d6aa70" stroke="#986e45" strokeWidth="2"/>
    <circle cx="24" cy="14" r="2.5" fill="#788b88"/><circle cx="43" cy="14" r="2.5" fill="#788b88"/>
  </>),
  'french-petanque': (<>
    <ellipse cx="32" cy="46" rx="27" ry="9" fill="#d8c6a3"/>
    <circle cx="16" cy="24" r="5" fill="#d59b48" stroke="#aa783c" strokeWidth="2"/>
    <circle cx="24" cy="38" r="12" fill="#a5b4b0" stroke="#687f7b" strokeWidth="2"/>
    <circle cx="46" cy="32" r="12" fill="#b9c7c0" stroke="#687f7b" strokeWidth="2"/>
    <path d="M16 29Q25 35 20 49M21 27Q30 35 26 50M38 23Q47 29 43 43M44 20Q53 28 49 44" fill="none" stroke="#7a918c" strokeWidth="1.6"/>
  </>),
  'english-hearth-bellows': (<>
    <path d="M9 37L3 39L9 43L17 39" fill="#b79654" stroke="#816b40" strokeWidth="2"/>
    <path d="M13 32Q32 20 45 34L58 30L60 36L46 41Q29 51 13 41Z" fill="#684b3d" stroke="#4f3b32" strokeWidth="2"/>
    <path d="M14 28Q31 13 43 27L56 21L59 27L45 34Q29 43 14 34Z" fill="#d3a06c" stroke="#91664d" strokeWidth="2"/>
    <path d="M18 36Q32 43 43 35M18 40Q30 47 43 39" fill="none" stroke="#af794d" strokeWidth="2"/>
  </>),
  'mexican-metate': (<>
    <path d="M14 36L18 53M49 36L46 53M32 23V40" stroke="#686b64" strokeWidth="7" strokeLinecap="round"/>
    <path d="M10 25Q31 30 54 25L51 40Q32 46 13 40Z" fill="#747a70" stroke="#535b54" strokeWidth="2"/>
    <ellipse cx="32" cy="26" rx="22" ry="8" fill="#92978a"/>
    <path d="M19 24L46 22" stroke="#dfbe72" strokeWidth="3" strokeLinecap="round"/>
    <path d="M12 19L51 16" stroke="#686b64" strokeWidth="9" strokeLinecap="round"/>
  </>),
  'czech-wooden-ratchet': (<>
    <path d="M19 37V8H29V37" fill="none" stroke="#d8b77e" strokeWidth="5" strokeLinejoin="round"/>
    <path d="M17 8H42" stroke="#9a7148" strokeWidth="7" strokeLinecap="round"/>
    <path d="M37 10Q40 25 35 36" stroke="#efd8a2" strokeWidth="3" fill="none"/>
    <path d="M21 27L26 30L31 27L33 32L39 32L37 38L41 42L35 45L35 51L28 49L24 53L20 47L14 47L16 41L12 37L18 34Z" fill="#9a7148" stroke="#71583b" strokeWidth="1.5"/>
    <path d="M25 39L40 53" stroke="#d8b77e" strokeWidth="9" strokeLinecap="round"/>
    <path d="M40 8H43" stroke="#8ab59a" strokeWidth="7"/>
  </>),
  'puerto-rican-guiro': (<>
    <path d="M22 8Q31 7 31 14L37 38Q39 55 24 57Q10 56 12 40L17 14Q17 8 22 8Z" fill="#d5aa62" stroke="#98713e" strokeWidth="2"/>
    <ellipse cx="24" cy="10" rx="6" ry="3" fill="#77633e" stroke="#f0ddb0" strokeWidth="2"/>
    <path d="M16 24L33 24M15 29H34M14 34H35M13 39H36M13 44H36M15 49H34" stroke="#b98b47" strokeWidth="2"/>
    <path d="M34 36L54 22" stroke="#b98b57" strokeWidth="5" strokeLinecap="round"/>
    <path d="M46 27L56 20" stroke="#98713e" strokeWidth="8" strokeLinecap="round"/>
  </>),
  'valencian-folding-fan': (<>
    <path d="M32 51L7 22Q32 3 57 22Z" fill="#e9aa86" stroke="#b28a56" strokeWidth="2" strokeLinejoin="round"/>
    <path d="M10 25Q32 9 54 25" fill="none" stroke="#6fa9a1" strokeWidth="4"/>
    <path d="M32 51L15 22M32 51L24 17M32 51V15M32 51L40 17M32 51L49 22" stroke="#b28a56" strokeWidth="1.5"/>
    <circle cx="32" cy="51" r="4" fill="#b99b53" stroke="#8c743b"/>
  </>),
  'mexican-tortilla-press': (<>
    <path d="M10 39H52V51H10Z M11 14L15 10L49 27L45 32Z" fill="#d6a96b" stroke="#a17446" strokeWidth="2" strokeLinejoin="round" />
    <ellipse cx="31" cy="39" rx="14" ry="4" fill="#eed79f"/>
    <path d="M48 40V22L28 8" fill="none" stroke="#69797b" strokeWidth="4" strokeLinecap="round"/>
    <path d="M28 8L23 5" stroke="#408d87" strokeWidth="6" strokeLinecap="round"/>
  </>),
  'ghanaian-oware': (<>
    <path d="M15 13H49a9 9 0 0 1 9 9V42a9 9 0 0 1-9 9H15a9 9 0 0 1-9-9V22a9 9 0 0 1 9-9Z" fill="#cc9b60" stroke="#9d683e" strokeWidth="2" />
    {[0,1,2,3,4,5].map(i => <g key={i}>{[24,40].map(y => <g key={y}><ellipse cx={12+i*8} cy={y} rx="3.3" ry="5" fill="#9d683e"/><ellipse cx={12+i*8} cy={y} rx="1.6" ry="2.1" fill="#a5b4a8"/></g>)}</g>)}
  </>),
  'chinese-rattle-drum': (<>
    <path d="M27 30v18" stroke="#cc9a5d" strokeWidth={5} strokeLinecap="round"/><path d="M27 39v7" stroke="#3b8f89" strokeWidth={6} strokeLinecap="round"/>
    <circle cx={27} cy={20} r={15} fill="#f1deb3" stroke="#ca7052" strokeWidth={3}/><circle cx={27} cy={20} r={6} fill="none" stroke="#3b8f89" strokeWidth={1.6}/>
    <path d="M12 20 6 30m36-10 6 10" stroke="#b8a36f" strokeWidth={1.5}/><circle cx={6} cy={31} r={4} fill="#579bb5"/><circle cx={48} cy={31} r={4} fill="#d69b50"/>
  </>),
  'chinese-tangram': (<>
    <path d="M7 7h40L27 27Z" fill="#d77759"/><path d="M7 7v40l20-20Z" fill="#e2b955"/>
    <path d="m47 47-20 0 20-20Z" fill="#58a397"/><path d="m27 27 10-10v20Z" fill="#74acc0"/>
    <path d="m27 27 10 10-10 10-10-10Z" fill="#a18ab6"/><path d="m7 47 10-10 10 10Z" fill="#a4c6d1"/>
    <path d="m47 7 0 20-10 10V17Z" fill="#c9878d"/><path d="M7 7h40v40H7Z" fill="none" stroke="#b18a54" strokeWidth={1.3}/>
  </>),
  'chinese-diabolo': (<>
    <path d="M8 8v21m38-21v21" stroke="#a47743" strokeWidth={3.4} strokeLinecap="round"/>
    <path d="M8 9 25 39 46 9" fill="none" stroke="#d6b86f" strokeWidth={1.7}/>
    <path d="m19 31 19 5" stroke="#775235" strokeWidth={3.4}/>
    <ellipse cx={19} cy={31} rx={7} ry={11} fill="#efd19c" stroke="#3c928a" strokeWidth={2}/>
    <ellipse cx={36} cy={35} rx={7} ry={11} fill="#efd19c" stroke="#3c928a" strokeWidth={2}/>
    <path d="m17 26 4 4m13 0 4 4" stroke="#cb7454" strokeWidth={2} strokeLinecap="round"/>
  </>),
  'korean-yutnori': (<>
    <path d="M7 5h40v31H7Z" fill="#d6e5dc" stroke="#618b7b" strokeWidth={1.3}/>
    <path d="M13 10h28v21H13Zm0 0 28 21m0-21L13 31" fill="none" stroke="#287680" strokeWidth={1.2}/>
    {[ [13,10],[27,10],[41,10],[13,20],[27,20],[41,20],[13,31],[27,31],[41,31] ].map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r={2.4} fill="#f7e2b4" stroke="#287680"/>)}
    <circle cx={41} cy={25} r={4} fill="#379cb2" stroke="#287680"/>
    {[10,20,30,40].map((x,i)=><path key={i} d={`M${x} 40q3-3 6 0v10h-6Z`} fill={i%2?'#d6a15d':'#f2d197'} stroke="#a3693b" strokeWidth={1.1}/>)}
  </>),
  'russian-matryoshka': (<>
    <path d="M22 5c-8 0-10 9-8 14-5 5-8 11-8 20 0 8 31 8 31 0 0-9-3-15-8-20 3-5 1-14-7-14Z" fill="#368c91" stroke="#436e70" strokeWidth={1.3}/>
    <path d="M14 19C8 1 34 0 29 19l-7 8Z" fill="#ca644b"/>
    <ellipse cx={22} cy={14} rx={5.5} ry={6.5} fill="#f4d7a3"/><path d="M19 14h1m4 0h1m-5 4h3" stroke="#584941" strokeLinecap="round"/>
    <ellipse cx={22} cy={35} rx={8} ry={9} fill="#f0ddb0"/><path d="M22 40V31m0 5-4-2m4 1 4-2" stroke="#689073"/><circle cx={22} cy={30} r={4} fill="#ca7155"/><circle cx={22} cy={30} r={1.5} fill="#e4b45e"/>
    <path d="M8 26h27" stroke="#426d70"/>
    <path d="M42 22c-5 0-6 6-4 9-4 3-5 7-5 11 0 5 17 5 17 0 0-4-2-8-5-11 2-3 2-9-3-9Z" fill="#8aad87" stroke="#608874"/>
    <ellipse cx={42} cy={28} rx={3.6} ry={4.5} fill="#f4d7a3"/><circle cx={42} cy={39} r={3} fill="#e4b052"/>
  </>),
  'japanese-koinobori': (<>
    <path d="M9 44V7" stroke="#aa8256" strokeWidth={3} strokeLinecap="round"/>
    <circle cx={9} cy={7} r={3} fill="#c4a161"/>
    <path d="M10 15h9M10 16v20" stroke="#72674e" fill="none"/>
    <path d="M19 11Q32 8 40 16L48 11l-3 9 3 8-8-5Q29 29 19 23Z" fill="#4d9c9d" stroke="#347276" strokeWidth={1.2}/>
    <ellipse cx={19} cy={17} rx={2.5} ry={6} fill="#cb7154"/>
    <circle cx={25} cy={16} r={3} fill="#f0dcab"/><circle cx={25} cy={16} r={1.6} fill="#294a50"/>
    <path d="M31 12q5 5 0 9m5-7q4 4 0 7" fill="none" stroke="#f0dcab" strokeWidth={1.3}/>
  </>),
  'japanese-kendama': (<>
    <path d="M21 43h10l-3-22-2-11-2 11Z" fill="#d9ad72" stroke="#9a7046" strokeWidth={1.5}/>
    <path d="M12 22h28v7H12Z" fill="#c99b61" stroke="#9a7046" strokeWidth={1.5}/>
    <ellipse cx={12} cy={25.5} rx={3} ry={6} fill="#eed1a0" stroke="#9a7046"/>
    <ellipse cx={40} cy={25.5} rx={3} ry={5} fill="#eed1a0" stroke="#9a7046"/>
    <path d="M26 28Q40 40 44 20Q47 9 33 9" stroke="#706b52" fill="none" strokeWidth={1.2}/>
    <circle cx={14} cy={10} r={8} fill="#d45343" stroke="#9a4437"/>
    <path d="M7 7h14" stroke="#f0dcb2" strokeWidth={2}/>
  </>),
  'indian-charkha': (<>
    <circle cx={31} cy={18} r={13} fill="none" stroke="#b77b42" strokeWidth={3}/>
    <path d="M18 18h26M31 5v26M22 9l18 18M22 27 40 9" stroke="#c9955b" strokeWidth={2}/>
    <path d="M31 18v22M8 40h34M11 28v12" stroke="#89552f" strokeWidth={3}/>
    <path d="m31 5-21 19m0 5 22 2" stroke="#8b7151" fill="none"/>
    <path d="M10 27h8" stroke="#727d80" strokeWidth={3}/>
    <ellipse cx={8} cy={33} rx={6} ry={4} fill="#f3e8cf" stroke="#b9a990"/>
    <circle cx={36} cy={17} r={2.5} fill="#89552f"/>
  </>),
  'german-nutcracker': (<>
    <path d="M33 22h5l3 13" fill="none" stroke="#ae7c48" strokeWidth={4} strokeLinecap="round"/>
    <Part d="M15 24h18v15H15Z" fill="#527c69"/>
    <Part d="M16 11h16v15H16Z" fill="#d9ad72"/>
    <path d="M14 11h20M18 4h12v6H18Z" fill="#3b4548" stroke="#3b4548" strokeWidth={3}/>
    <path d="M20 39v5m8-5v5" stroke="#3b4548" strokeWidth={5}/>
    <circle cx={20} cy={17} r={1.3}/><circle cx={28} cy={17} r={1.3}/>
    <path d="M19 23h10l-5 8Z" fill="#f2e6c9"/>
    <circle cx={8} cy={38} r={4} fill="#996237"/>
  </>),
  'mexican-molinillo': (<>
    <path d="M36 25c12-3 12 13 0 10" fill="none" stroke="#ad5b39" strokeWidth={4}/>
    <Part d="M8 23h28l-3 17q-10 6-22 0Z" fill="#bc6846"/>
    <ellipse cx={22} cy={24} rx={14} ry={5} fill="#6c3a26" stroke="#efc596" strokeWidth={2}/>
    <path d="M22 4v25" stroke="#c79659" strokeWidth={5} strokeLinecap="round"/>
    <path d="M17 17h10m-11 4h12" stroke="#89502f" strokeWidth={3} strokeLinecap="round"/>
    <circle cx={14} cy={25} r={2} fill="#d7aa72"/><circle cx={30} cy={26} r={2.5} fill="#d7aa72"/>
  </>),
  'malawi-sansi': (<>
    <Part d="M10 5h28q4 0 4 5v29q0 4-5 4H11q-5 0-5-4V10q0-5 4-5Z" fill="#b67c48"/>
    {[14,19,24,29,34].map((x,i)=><path key={x} d={`M${x} 10v${[18,23,28,22,17][i]}`} stroke="#b3ccd0" strokeWidth={3} strokeLinecap="round"/>)}
    <path d="M9 15h30" stroke="#705038" strokeWidth={3}/><path d="M10 12h28" stroke="#dbb272" strokeWidth={2}/>
    <circle cx={12} cy={37} r={2} fill="none" stroke="#c5d4ca"/><circle cx={36} cy={37} r={2} fill="none" stroke="#c5d4ca"/>
  </>),
  'chinese-suanpan': (<>
    <Part d="M6 6h36v36H6Z" fill="#865338"><path d="M11 10h26v28H11Z" fill="#f1deba"/></Part>
    {[15,24,33].map(x=><g key={x}><path d={`M${x} 10v28`} stroke="#9a7947" strokeWidth={1.5}/>{[12,16,25,28,31,34,37].map(y=><ellipse key={y} cx={x} cy={y} rx={3.7} ry={1.4} fill="#c58a47" stroke="#684631" strokeWidth={.8}/>)}</g>)}
    <path d="M8 21h32" stroke="#865338" strokeWidth={3}/><path d="M7 10V7h4m26 0h4v3M7 37v4h4m26 0h4v-4" stroke="#d5b876" strokeWidth={2} fill="none"/>
  </>),
  'mongolian-felt-ger': (<>
    <Part d="M5 24L20 10h9l14 14v17H5Z" fill="#eee5cc"><path d="M29 11L43 24v17H31V24Z" fill="#d8ccb0"/></Part>
    <path d="M5 25h38M6 32h36M20 11L12 24m17-13 7 13" stroke="#877053" strokeWidth={1.5} fill="none"/>
    <Part d="M19 27h11v14H19Z" fill="#43818b"><path d="M22 30h5v8h-5Z" fill="#bc684c"/></Part>
    <Part d="M19 9q5-4 11 0l-1 3H20Z" fill="#bd6946"/>
  </>),
  'peruvian-engraved-gourd': (<>
    <Cord d="M25 12q-4-5 0-8" color="#8e7950" width={3}/>
    <Part d="M19 11q5-3 10 0l1 7q13 5 11 16-1 10-17 10S5 39 7 30q1-9 12-12Z" fill="#c98b48">
      <path d="M30 19q11 17-6 25 16 0 17-10 2-10-11-15Z" fill="#a7673c"/>
    </Part>
    <path d="M10 30q7-8 15-1t13-1M12 36q12 7 25-1M18 33l3-5 2 7m6-5 4-4-1 8" fill="none" stroke="#f1d391" strokeWidth={1.5}/>
    <path d="M15 22q-5 3-4 7" fill="none" stroke="#edd3a0" strokeWidth={2.2}/>
  </>),
  'venetian-glass-bead': (<>
    <Cord d="M5 37q18 10 35-4" color="#d6b788" width={1.2}/>
    <Part d="M14 11q14-8 23 4t-1 21q-14 9-23-4t1-21Z" fill="#75b9ad">
      <path d="M32 12q10 18-7 27 9-1 14-8 4-13-7-19Z" fill="#4c958c"/>
    </Part>
    <path d="M15 14q15-1 21 16M12 24q15-2 19 14" fill="none" stroke="#e9bd78" strokeWidth={3}/>
    <ellipse cx={17} cy={24} rx={3} ry={6} fill="#56877d" stroke={INK} strokeWidth={1.4}/>
    <path d="M20 13q6-3 10 1" fill="none" stroke="#f1f6dd" strokeWidth={2.8}/>
    <circle cx={9} cy={36} r={4} fill="#d79674" stroke={INK} strokeWidth={1.6}/>
  </>),
  'korean-bojagi-wrap': (<>
    <Part d="M8 22 23 15 40 22 37 39 12 40Z" fill="#88a58a"/>
    <Part d="M8 22 25 29 23 15Z" fill="#e5c88c"/>
    <Part d="M25 29 40 22 37 39 25 40Z" fill="#d78e7c"/>
    <path d="M12 31 25 35 38 29M19 19 18 26 16 39" stroke="#f6e9cc" fill="none" strokeWidth={1.3} strokeDasharray="2 2"/>
    <Part d="M24 21Q9 8 14 7q9-2 12 13Q29 7 35 9q5 7-9 12Z" fill="#e8d6ab"/>
    <Cord d="M24 22 20 29M26 22 31 27" color="#d78e7c" width={2}/>
  </>),
  'vietnamese-bamboo-dragonfly': (<>
    <Part d="M17 41q7-5 14 0l3 4H14Z" fill="#b0b29b"/>
    <Cord d="M24 42V23" color="#b89963" width={2}/>
    <Part d="M23 21Q2 10 4 6q9-1 21 15Q37 5 44 7q1 7-19 16Z" fill="#7bb4a4"/>
    <Part d="M24 23Q4 20 6 15q10 0 18 8Q36 12 42 16q-1 5-18 9Z" fill="#e2ad6a"/>
    <Cord d="M24 19 29 36" color="#ca8067" width={2}/>
    <circle cx={22} cy={20} r={2.4} fill="#e8cf8d" stroke={INK} strokeWidth={1.2}/>
    <circle cx={26} cy={20} r={2.4} fill="#e8cf8d" stroke={INK} strokeWidth={1.2}/>
  </>),
  'turkish-ebru-paper': (<>
    <Part d="M5 12h38v28H5Z" fill="#b2916c"/>
    <Part d="M9 9h30v27H9Z" fill="#f2e6c9"/>
    <path d="M10 13q21 17 28 3M10 20q15-12 28 9M10 30q11-8 28 4" fill="none" stroke="#69a8a0" strokeWidth={4}/>
    <path d="M10 17q13 15 28 5M10 33q17-17 28-5" fill="none" stroke="#d27f69" strokeWidth={2}/>
    <Cord d="M32 5 22 25" color="#dbb87a" width={1.4}/>
  </>),
  'indonesian-angklung': (<>
    <Cord d="M8 42V7h32v35M8 37h32" color="#c8ab6c" width={3}/>
    <Cord d="M17 8v9M30 8v15" color="#877d4b" width={1}/>
    <Part d="M13 16h8v19h-8Z" fill="#cdbb71"/>
    <Part d="M26 22h8v13h-8Z" fill="#a7ad67"/>
    <ellipse cx={17} cy={16} rx={4} ry={2} fill="#645b3b"/>
    <ellipse cx={30} cy={22} rx={4} ry={2} fill="#645b3b"/>
    <path d="M13 28h8m5 1h8M8 11h4m24 0h4" stroke="#7b8150" strokeWidth={1.4}/>
  </>),
  'weifang-paper-kite': (<>
    <Cord d="M24 24Q19 31 32 37Q38 41 29 45" color="#e6d3ad" width={1}/>
    <Part d="M24 7 28 13 43 5 37 23 28 22 31 32 24 27 17 32 20 22 11 23 5 5 20 13Z" fill="#65a8a0"/>
    <path d="M24 7v20M6 7 24 18 42 7" fill="none" stroke="#f2d187" strokeWidth={2}/>
    <Part d="M21 13q3-4 6 0v11l-3 3-3-3Z" fill="#d8785f"/>
    <path d="M11 13l5 4m21-4-5 4" stroke="#f1d79c" strokeWidth={2}/>
  </>),
  'chinese-shadow-puppet': (<>
    <Part d="M5 6h38v32H5Z" fill="#bd8762"/>
    <Part d="M9 10h30v24H9Z" fill="#f3d89e"/>
    <path d="M11 20 21 22Q23 12 30 16l6 3-6 2q-1 8-9 7Z" fill="#99754f" opacity={.4}/>
    <Part d="M9 22 20 24Q22 15 28 19l6 3-6 2q-1 8-9 6Z" fill="#cf7954"/>
    <Part d="M19 25 13 15 25 23 25 27Z" fill="#578f89"/>
    <circle cx={24} cy={25} r={1.5} fill="#f3d89e"/><circle cx={27} cy={21} r={.8} fill={INK}/>
    <Cord d="M20 30 18 44M15 21 10 42" color="#a67d50" width={1}/>
  </>),
  'faroese-wool-knit': (<>
    <Cord d="M6 7 39 24M42 6 14 29" color="#b9946a" width={2.4}/>
    <Part d="M11 20h26v23H11Z" fill="#e7dfcd"/>
    {[16,24,32].map(x => <path key={x} d={`M${x-3} 25l3 4 3-4m-6 7 3 4 3-4m-6 7 3 3 3-3`} fill="none" stroke="#8a8277" strokeWidth={2.2}/>)}
    <circle cx={39} cy={35} r={6} fill="#c6bba6" stroke={INK} strokeWidth={1.5}/>
    <path d="M35 31q8 3 8 7m-10-3q7 0 9 5" fill="none" stroke="#8a8277" strokeWidth={1.1}/>
  </>),
  'niue-shell-necklace': (<>
    <Cord d="M16 8Q2 31 17 41Q26 47 36 37Q46 24 32 8" color="#d5c9a2" width={1.3}/>
    {[[13,15],[10,24],[12,33],[19,40],[28,40],[36,33],[38,24],[35,15]].map(([x,y],i)=><g key={i} transform={`translate(${x} ${y}) rotate(${i*36})`}>
      <path d="M-3 3Q-6-1-2-4Q3-7 5-1Q6 4 1 4Q-2 4-2 1Q-2-2 1-2Q3-2 2 1" fill="#edc45f" stroke={INK} strokeWidth={1.1}/>
      <ellipse cx={2} cy={2.5} rx={1.5} ry={.9} fill="#9e743d"/>
    </g>)}
  </>),
  'polish-paper-cut': (<>
    <Part d="M7 5h34v38H7Z" fill="#efe6ce"/>
    <Part d="M22 39V32L12 35 8 28 18 25 9 20 12 14 20 20 17 9 24 5 31 9 28 20 36 14 39 20 30 25 40 28 36 35 26 32V39Z M23 12h2v5h-2Z M13 29l6-1-4 3Z M29 28l6 1-2 2Z" fill="#376c68" evenodd/>
    <path d="M24 22v12" fill="none" stroke="#a4c4b6" strokeWidth={1.2}/>
  </>),
  'uzbek-clay-bowl': (<>
    <Part d="M21 33h6v10h-6Z" fill="#937452"/>
    <ellipse cx={24} cy={34} rx={20} ry={5} fill="#b69a76" stroke={INK} strokeWidth={2}/>
    <Part d="M9 15Q10 31 24 32Q38 31 39 15Z" fill="#ad785a"/>
    <ellipse cx={24} cy={15} rx={15} ry={6} fill="#81563f" stroke={INK} strokeWidth={2}/>
    <ellipse cx={24} cy={16} rx={11} ry={3.2} fill="#a57352"/>
    <path d="M13 23q11 6 22 0M17 28q7 3 14 0" fill="none" stroke="#d6aa84" strokeWidth={1.3}/>
  </>),
  'chinese-woodblock-print': (<>
    <Part d="M7 9h31v33H7Z" fill="#b59467"/>
    <Part d="M11 5h29v31H11Z" fill="#eee6cc"/>
    <path d="M24 31V13m0 8-8-6m8 11 9-7" fill="none" stroke="#334c5b" strokeWidth={2}/>
    <path d="M23 21q-11 0-9-9 9 0 9 9m3 4q0-10 10-9 0 9-10 9m-1-8q-6-7 1-10 6 5-1 10" fill="#59777b"/>
    <Part d="m5 33 13 3-2 8-13-3Z" fill="#ad8751"/>
    <path d="m5 39 10 2" stroke="#70513b" strokeWidth={2}/>
  </>),
  'czech-bead-star': (<>
    <Cord d="M24 5v38M7 14l34 20M7 34l34-20" color="#b8b5a3" width={1}/>
    {[ [24,9],[24,16],[24,32],[24,39],[11,16],[17,20],[31,28],[37,32],[11,32],[17,28],[31,20],[37,16] ].map(([x,y],i)=>
      <g key={i}><circle cx={x} cy={y} r={3.7} fill={i%2 ? "#739daf" : "#dce8e8"} stroke={INK} strokeWidth={1.2}/><circle cx={x-.7} cy={y-.9} r={1} fill="#fff8e9"/></g>
    )}
    <circle cx="24" cy="24" r="4.4" fill="#c8b779" stroke={INK} strokeWidth={1.3}/>
  </>),
  'fijian-woven-fan': (<>
    <Part d="M21 29h6l-1 16h-4Z" fill="#ad8751"/>
    <Part d="M24 3C19 9 5 11 7 22c1 9 10 12 17 11 7 1 16-2 17-11C43 11 29 9 24 3Z" fill="#d9bd7f"/>
    <path d="m12 15 22 13M10 22l18 10M18 9l20 12M36 15 14 28m24-6L20 32M30 9 10 21" fill="none" stroke="#ad8751" strokeWidth={1}/>
    <Cord d="M21 33h6m-6 3h6" color="#788b63" width={1.5}/>
  </>),
  'amazigh-woven-rug': (<>
    <Part d="M9 7h30v33H9Z" fill="#e6d9bd"/>
    <path d="M10 12h28v4H10Zm0 20h28v4H10Z" fill="#a95f4c"/>
    <path d="m24 19 6 5-6 5-6-5Z" fill="#b78343"/>
    <path d="M11 18h6v3h-6m26-3h-6v3h6M11 27h6v3h-6m26-3h-6v3h6" fill="#566e83"/>
    <path d="M12 3v4m6-4v4m6-4v4m6-4v4m6-4v4M12 40v5m6-5v5m6-5v5m6-5v5m6-5v5" stroke="#ad8751" strokeWidth={2}/>
  </>),
  'slovak-wire-bird': (<>
    <Cord d="M7 27 3 16l12 7c1-12 13-17 20-10l9 4-8 3c-1 16-19 22-29 7Z" color="#79746b" width={1.5}/>
    <Cord d="M14 25c6-14 20-4 11 5-7 7-16 1-11-5ZM20 35v7m8-9v9" color="#b68d61" width={1.5}/>
    <circle cx="31" cy="16" r="1.5" fill={INK}/><Part d="M11 42h25v4H11Z" fill="#c5ad82"/>
  </>),
  'hungarian-embroidery-hoop': (<>
    <circle cx="24" cy="26" r="18" fill="#efe5d0" stroke={INK} strokeWidth={5}/>
    <circle cx="24" cy="26" r="18" fill="none" stroke="#c7a273" strokeWidth={2.5}/>
    <Part d="M19 3h10v7H19Z" fill="#c7a273"/>
    <path d="M24 37V20m0 11-9-7m9 2 8-7" fill="none" stroke="#678e77" strokeWidth={2}/>
    <path d="M24 24c-15-5-7-18 0-9 7-9 15 4 0 9Z" fill="#bc6e78"/>
    <path d="M21 31q-12 2-10-8 10-1 10 8m5-4q-1-10 10-9 2 9-10 9" fill="#8aa493"/>
  </>),
  'andalusian-ceramic-tile': (<>
    <Part d="M4 4h40v40H4Z" fill="#aa815f"/><Part d="M8 8h32v32H8Z" fill="#f2efe0"/>
    <path d="M18.7 8v32M29.3 8v32M8 18.7h32M8 29.3h32" stroke="#c4b9a0" strokeWidth={1.2}/>
    {[13.3,24,34.7].flatMap(x => [13.3,24,34.7].map(y => <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
      <path d="M0-1q-5-5 0-5 5 0 0 5M0 1q5 5 0 5-5 0 0-5" fill="#416c9b"/>
      <path d="M-1 0q-5 5-5 0 0-5 5 0M1 0q5-5 5 0 0 5-5 0" fill="#82b5b0"/>
      <circle r="1.2" fill="#cea452"/>
    </g>))}
  </>),
  'sicilian-painted-cart': (<>
    <Part d="m8 11 30 4v16L8 27Z" fill="#d3aa61"/>
    <path d="m11 15 24 4v5l-24-4Z" fill="#568e8b"/>
    <Cord d="m32 29 12 6" color="#bd765d" width={2.5}/>
    <circle cx="15" cy="34" r="10" fill="#d3aa61" stroke={INK} strokeWidth={2.2}/>
    <circle cx="15" cy="34" r="7" fill="#efe5d0" stroke="#b86e51" strokeWidth={1.5}/>
    <path d="M15 27v14m-7-7h14m-12-5 10 10m-10 0 10-10" stroke="#8c735a" strokeWidth={1.4}/>
    <circle cx="15" cy="34" r="2.2" fill="#b86e51"/>
  </>),
  'bai-indigo-cloth': (<>
    <Cord d="M6 9h36M9 9v34m30-34v34" color="#b9976a" width={2.5}/>
    <Part d="M13 8h22v28q-11-3-22 0Z" fill="#497f9e"/>
    <path d="m24 13 6 7-6 7-6-7Zm-9 17h18" fill="none" stroke="#f3e8cc" strokeWidth={2.5}/>
  </>),
  'ndebele-painted-house': (<>
    <Part d="M6 12h36v32H6Z" fill="#eadcc3"/>
    <Part d="M17 28h14v16H17Z" fill="#80644d"/>
    <path d="M8 22h32M12 25v14m24-14v14" stroke="#558d8c" strokeWidth={4}/>
    <path d="m24 15 5 4-5 4-5-4Z" fill="#c77a51" stroke={INK} strokeWidth={1.5}/>
    <path d="M9 40h7m16 0h7" stroke="#d3a955" strokeWidth={3}/>
  </>),
  'purepecha-copper-bowl': (<>
    <Part d="M5 20c0 28 38 28 38 0Z" fill="#bc794f"/>
    <ellipse cx="24" cy="20" rx="19" ry="9" fill="#ce9568" stroke={INK} strokeWidth={2.2}/>
    <ellipse cx="24" cy="21" rx="14" ry="5" fill="#976245"/>
    <path d="m12 30 3 2m4 2 3 1m8-2 3-2" stroke="#e9b27e" strokeWidth={2.2} strokeLinecap="round"/>
  </>),
  'welsh-love-spoon': (<>
    <Part d="M21 27V18C8 5 16-3 24 6 32-3 40 5 27 18v9c12 7 8 18-3 18s-15-11-3-18Z M24 15c-8-7-5-10 0-4 5-6 8-3 0 4Z" fill="#c69050" evenodd/>
    <ellipse cx="24" cy="35" rx="5" ry="6.5" fill="#a67547"/>
    <path d="M27 30q6 8-2 11" fill="none" stroke="#e5bc80" strokeWidth={1.7}/>
  </>),
  'barcelos-clay-rooster': (<>
    <Part d="M20 34C7 32 5 16 7 8c8 0 12 8 11 14l9-4V9l7-4 5 4-5 5v12c0 6-6 9-14 8Z" fill="#405e5a"/>
    <Part d="m28 8-1-6 4 2 3-3 3 5-3 4Z" fill="#c76b55"/>
    <Part d="m34 12 10 3-10 4Z" fill="#e2bb74"/>
    <circle cx="31" cy="12" r="1.4" fill={INK}/>
    <path d="m21 25 5-4 4 5-5 4Z" fill="#f0dfb3"/>
    <Cord d="M21 33v7m7-7v7" color="#c79454" width={2.5}/><Part d="M12 41h25v4H12Z" fill="#bc7057"/>
  </>),
  'finnish-birch-basket': (<>
    <Cord d="M12 23C9-3 39-3 36 23" color="#c9a568" width={4}/>
    <Part d="m6 21 5 22h26l5-22Z" fill="#d6b981"/>
    <path d="m10 23 19 19m-8-19 17 17m-1-17L18 42m8-19L10 38m-2-8h32m-30 7h28" fill="none" stroke="#a6824f" strokeWidth={2.3}/>
    <Part d="M5 18h38v6H5Z" fill="#eddaae"/>
  </>),
  'croatian-licitar-heart': (<>
    <Cord d="M21 8C12-2 34-2 27 8" color="#829b84" width={2}/>
    <Part d="M24 13C8-4-7 18 24 45 55 18 40-4 24 13Z" fill="#c75e53"/>
    <path d="M24 19C12 5 2 20 24 38 46 20 36 5 24 19Z" fill="none" stroke="#f0dfb3" strokeWidth={2}/>
    <ellipse cx="24" cy="25" rx="5" ry="6" fill="#b7d4cc" stroke="#e6c477" strokeWidth={2}/>
  </>),
  'catalan-festival-giant': (<>
    <Part d="M19 21h10l9 22H10Z" fill="#bc7057"/>
    <Part d="m18 20-6 12 4 2 5-10m9-4 6 12-4 2-5-10" fill="#608e89"/>
    <Part d="M18 19h12v10H18Z" fill="#608e89"/>
    <circle cx="24" cy="13" r="7" fill="#e3b895" stroke={INK} strokeWidth={1.8}/>
    <Part d="M16 7h16v4H16Zm4-5h8v5h-8Z" fill="#d6ac60"/>
    <circle cx="22" cy="13" r=".9" fill={INK}/><circle cx="26" cy="13" r=".9" fill={INK}/>
    <circle cx="20" cy="23" r="2.5" fill="#f0dfb3"/><Part d="M7 43h34v3H7Z" fill="#b9976a"/>
  </>),

  'sorbian-painted-egg': (<>
    <Part d="M24 4C14 4 7 23 9 33c3 15 27 15 30 0C41 23 34 4 24 4Z" fill="#b87b66"/>
    <path d="m14 24 10-8 10 8-10 8Z" fill="#efdfac" stroke={INK} strokeWidth={1.5}/>
    <path d="M12 34q12 7 24 0" fill="none" stroke="#f3e4bb" strokeWidth={3}/>
    <circle cx="24" cy="24" r="3" fill="#829b84"/>
  </>),
  'basque-sunflower': (<>
    <Part d="m24 3 4 12 9-10-3 13 12-3-9 9 9 4-13 3 4 12-10-9-3 13-4-13-9 9 3-13-12-3 12-4-10-9 13 3-3-13 9 10Z" fill="#eee0b6"/>
    <circle cx="24" cy="24" r="9" fill="#b69462" stroke={INK} strokeWidth={2}/>
    <path d="m20 19 8 10m-10-5h12m-10 5 8-10" stroke="#dac18c" strokeWidth={1.5}/>
  </>),
  'breton-banner': (<>
    <Cord d="M9 5v38m0-36h31" color="#b9976a" width={3}/>
    <Part d="M13 9h24v28l-12-4-12 4Z" fill="#829b9d"/>
    <circle cx="25" cy="19" r="5" fill="#efdfac"/>
    <path d="M17 28q4-4 8 0t8 0" stroke="#efdfac" strokeWidth={2.4} fill="none"/>
    <Part d="M3 42h15v4H3Z" fill="#b9976a"/>
  </>),
  'lithuanian-straw-garden': (<>
    <Cord d="M24 2v6m0 29v5" color="#b9976a" width={1.5}/>
    <path d="m24 8 16 15-16 15L8 23Zm0 0v30M8 23h32" fill="none" stroke={INK} strokeWidth={3.8}/>
    <path d="m24 8 16 15-16 15L8 23Zm0 0v30M8 23h32" fill="none" stroke="#e4c783" strokeWidth={2}/>
    <path d="m24 38 5 5-5 4-5-4Z" fill="none" stroke="#b9976a" strokeWidth={2}/>
  </>),
  'dalarna-wooden-horse': (
    <>
      <Part d="M8 22q-3-7 6-7h13l3-12 5 5 3-4 1 9 7 5-3 5-8-3 2 12-1 12h-6l-1-11H17l-3 11H8l3-17Z" fill="#bd5e4d"/>
      <Part d="M15 17h12v12H15Z" fill="#eee2bd"/>
      <path d="m18 20 3 5 3-5" stroke="#809c9c" strokeWidth={2.5} fill="none"/>
      <circle cx="36" cy="14" r="1.4" fill={INK}/>
    </>
  ),
  'aland-votive-ship': (
    <>
      <Part d="m4 30 7 11h27l7-11Z" fill="#b58c62"/>
      <Cord d="M24 5v27" color="#a78862" width={2}/>
      <Part d="M22 7 7 27h15Z" fill="#eee2bd"/>
      <Part d="M27 10v17h14Z" fill="#d5d4b4"/>
      <path d="M12 44h24m-20-5v5m16-5v5" stroke={INK} strokeWidth={2.5}/>
    </>
  ),
  'blang-tea': (
    <>
      <Part d="M35 19q14-7 10 6-2 6-10 5" fill="#819d8d"/>
      <Part d="M9 21q-1-8 8-10h12q10 2 9 14t-12 13h-7q-11-1-11-13l-6-9 8 5Z" fill="#819d8d"/>
      <Part d="M12 11h19l-4-5h-10Z" fill="#a8b8a0"/>
      <path d="M24 17q-11 5 0 13 7-8 0-13" fill="#d5dfb9"/>
      <Part d="M32 35h13q-1 9-7 9t-6-9Z" fill="#eee2bd"/>
    </>
  ),
  'minangkabau-spinning-top': (
    <>
      <Cord d="M24 4v11" color="#a68463" width={4}/>
      <Part d="M9 23q1-12 15-12t15 12L24 43Z" fill="#bd7e57"/>
      <path d="M12 24h24m-20 7h16" stroke="#eee2bd" strokeWidth={3}/>
      <Cord d="M10 20q29-11 30 2t-8 12" color="#e2d5af" width={1.8}/>
      <circle cx="32" cy="35" r="3.5" fill="#c6a467" stroke={INK} strokeWidth={1.8}/>
    </>
  ),
  'chinese-incense': (
    <>
      <Cord d="M22 27V8m6 19V5" color="#b47f54" width={2}/>
      <path d="M22 6q-6-3 0-5m6 1q5-3 0-5" fill="none" stroke="#b8b6a0" strokeWidth={1.7}/>
      <Part d="M8 25h32c0 18-32 18-32 0Z" fill="#9db6ad"/>
      <path d="M12 36v7m24-7v7m-12-5v6" stroke={INK} strokeWidth={3}/>
      <path d="M12 26h24" stroke="#f6e3bd" strokeWidth={3}/>
    </>
  ),
  'hongsheng-red-string': (
    <>
      <Part d="M18 5h12v29H18Z" fill="#d5b58d"/>
      <Part d="M8 36h32v6H8Z" fill="#d5b58d"/>
      <Cord d="M10 24c0-18 28-18 28 0S10 42 10 24Z" color="#c77872" width={3}/>
      <Part d="M21 32h6v6h-6Z" fill="#e4c487"/>
    </>
  ),
  'italian-ex-voto': (
    <>
      <Cord d="m12 44 9-38m6 0 9 38" color="#b89571" width={3}/>
      <Part d="M7 10h34v28H7Z" fill="#f4dfb6"/>
      <path d="M13 31q8-11 14-5t9-5" stroke="#a6bba6" strokeWidth={4} fill="none"/>
      <Part d="M25 15h10v12H25Z" fill="#ebbd77"/>
      <path d="M30 15v12m-5-6h10" stroke={INK} strokeWidth={1.5}/>
    </>
  ),
  'czech-pilgrim-journal': (
    <>
      <Part d="M3 12q11-5 21 0 10-5 21 0v28q-11-4-21 0-10-4-21 0Z" fill="#78978a"/>
      <Part d="M6 9q9-3 18 1 9-4 18-1v27q-9-3-18 1-9-4-18-1Z" fill="#f4e3bd"/>
      <path d="M24 10v27m-14-8 5-8 5 7m9-10 4 4-4 8" fill="none" stroke="#92ab91" strokeWidth={2}/>
      <path d="M36 10v30l-3-3-3 2V11" fill="#ce8e7c"/>
    </>
  ),
  omikuji: (
    <>
      <Part d="m9 15 10-5 10 5v26l-10 4-10-4Z" fill="#cead7c"><path d="m19 11 10 4v26l-10 4Z" fill="#b99567"/></Part>
      <path d="M19 6v18m-6-8 6 3 6-3" stroke={INK} strokeWidth={2}/>
      <Part d="M30 5h12v30H30Z" fill="#fff0d0"/><path d="M34 12h4m-4 5h4m-4 5h4" stroke="#ab8263" strokeWidth={1.8}/>
    </>
  ),
  'polish-blessing-basket': (
    <>
      <Cord d="M10 28C8 2 39 2 38 28" color="#c8a36d" width={3}/>
      <Part d="M5 26h38l-5 17H10Z" fill="#c4a276"/>
      <Part d="m6 25 9-5 9 5 11-5 8 5-7 10-12-4-10 4Z" fill="#fff0d0"/>
      <Part d="M10 26c-4-11 13-16 17-7l2 7Z" fill="#dbaf74"/>
      <Part d="M29 25c-3-5 1-13 5-13s8 9 5 13Z" fill="#ca8f88"/>
      <path d="M13 21l4-5m2 7 4-5m7 3h8M12 39h24m-19-4v8m8-8v8m8-8v8" stroke="#f7dfab" strokeWidth={1.7}/>
    </>
  ),
  'navruz-sumalak': (
    <>
      <Cord d="M7 26C0 16 7 15 12 23m25 3c11-10 4-11-1-3" color="#777f72" width={2.5}/>
      <Part d="M8 22h33c1 27-35 27-33 0Z" fill="#879082"><path d="M27 22h14c0 17-14 22-22 15 11 1 14-6 8-15Z" fill="#697768"/></Part>
      <ellipse cx="24" cy="22" rx="16" ry="6" fill="#b97e55" stroke={INK} strokeWidth={2}/>
      <path d="M15 23q8-6 17 0" stroke="#dbac71" strokeWidth={2} fill="none"/>
      <Cord d="M24 23 35 4" color="#c9a172" width={3}/>
    </>
  ),
  'floating-lantern-loy-krathong': (
    <>
      <path d="M5 41q8-4 16 0t21 0" stroke="#8ab5b0" fill="none" strokeWidth={2}/>
      <Part d="m5 29 5-13 10 9 7-9 10 9 7-8-4 16q-16 11-35-4Z" fill="#92b786"/>
      <Part d="m11 32 6-12 9 11 9-9 4 11q-14 9-28-1Z" fill="#abc394"/>
      <Part d="M24 15h5v16h-5Z" fill="#fff1cb"/>
      <Part d="M26 15c-7-3 0-9 0-12 1 4 7 10 0 12Z" fill="#ffd68a"/>
      <circle cx="19" cy="30" r="5" fill="#f8e5bb"/><circle cx="19" cy="30" r="2" fill="#d3a25f"/>
    </>
  ),
  'omamori-cycle': (
    <>
      <Cord d="M19 13Q11 2 20 3l4 8 4-8q9-1 1 10" color="#e9d7aa"/>
      <Part d="M13 12h22l4 8v22H9V20Z" fill="#e6a5a0"><path d="M29 12h6l4 8v22h-8V20Z" fill="#c78183"/></Part>
      <path d="M14 17h20M13 37h22" stroke="#fbe9b8" strokeWidth={2}/>
      <path d="M24 23c-5-5-8 1-4 3-4 5 1 7 4 4 4 3 7-2 3-4 3-4-2-6-3-3Z" fill="#fff0c3"/>
      <circle cx="24" cy="27" r="1.5" fill="#bc9c66"/>
    </>
  ),
  'shrine-suzu-bell': (
    <>
      <Cord d="M24 3v27" color="#e2c68e" width={5}/>
      <Part d="M12 18C8 5 19 3 24 3s16 2 12 15c-3 6-21 6-24 0Z" fill="#d8ad5e"><path d="M25 4q13 1 11 14c-2 4-9 5-12 5 4-5 5-12 1-19Z" fill="#b28b43"/></Part>
      <path d="M16 17q8-5 16 0" stroke={INK} strokeWidth={2.2}/>
      <Cord d="M24 24v12" color="#f0ddaa" width={5}/>
      <Part d="M19 35h10l4 9H15Z" fill="#c89075"/>
      <path d="M21 36v7m6-7v7" stroke="#fff0c6" strokeWidth={1.5}/>
    </>
  ),
  'st-brigids-cross': (
    <>
      <Part d="M17 4h8v13h18v8H31v18h-8V31H5v-8h12Z" fill="#a2b576"/>
      <path d="M19 5v19H6m37-6H24V5m5 38V24h14M5 29h19v14" stroke="#718b57" strokeWidth={2}/>
      <Part d="M17 17h14v14H17Z" fill="#c2cb8b"><path d="M19 20h9v8h-7v-5h4" stroke="#72844f" fill="none" strokeWidth={2}/></Part>
      <path d="M16 9h10M9 22v10m13 6h10m6-22v10" stroke="#dac8a0" strokeWidth={2.3}/>
    </>
  ),
  bokjori: (
    <>
      <Cord d="M18 14q-3-12 6-11t6 11" color="#b89761" width={3}/>
      <Part d="M9 18q15-12 30 0l3 14q-18 15-36 0Z" fill="#d5b775"><path d="M9 20q15 14 30 0l2 10q-16 10-34 0Z" fill="#b7945b"/></Part>
      <path d="M13 16v20m7-23v26m8-26v26m7-22v20M8 23h33M8 29h32m-27 6h22" stroke="#efe0aa" strokeWidth={1.6}/>
      <path d="M18 21h3m4 3h3m4-4h3" stroke="#fff1cc" strokeWidth={2.8} strokeLinecap="round"/>
      <Cord d="M23 37v7m3-7v5" color="#c89075" width={2}/>
    </>
  ),
  'ema-votive-plaque': (
    <>
      <Cord d="M15 18Q24 0 33 18" color="#bd925d" />
      <Part d="M9 20 24 11 39 20v24H9Z" fill="#edc892">
        <path d="m9 20 15-9 15 9v4l-15-8-15 8Z" fill="#d9ae74" />
        <circle cx="16" cy="22" r="2" fill={INK}/><circle cx="32" cy="22" r="2" fill={INK}/>
        <path d="M17 36q7-9 14-5m-7 6v-6" stroke="#83ae80" fill="none" strokeWidth={2}/>
        <path d="M24 27c-7-6-10 1-5 4-5 6 2 9 5 4 5 5 9-2 4-5 4-5-2-8-4-3Z" fill="#df8d8b"/>
        <circle cx="24" cy="31" r="2" fill="#ffeabd"/>
      </Part>
    </>
  ),
  'clootie-well-rag': (
    <>
      <Cord d="M13 44V5m0 14Q27 8 42 14" color="#ba9068" width={4}/>
      <Part d="M25 14h10l-1 24-9 2 2-15Z" fill="#afd6cf"><path d="m28 18 1 17m3-17-1 17" stroke="#79aaa5" strokeWidth={1.3}/></Part>
      <Part d="M3 35q8-7 18 0v8H3Z" fill="#c9c3ab"><ellipse cx="12" cy="35" rx="8" ry="3" fill="#90c5c6"/></Part>
    </>
  ),
  'diya-oil-lamp': (
    <>
      <Part d="M5 27q13-13 35-8l4 9q-4 16-22 16T5 27Z" fill="#cc8260"><path d="M7 27q14-10 33-6l-4 10q-16 5-29-4Z" fill="#e9b65e"/></Part>
      <Cord d="M23 30q8-2 12-8" color="#fff0b9" width={2.5}/>
      <Part d="M35 23c-12-3-2-16-1-21 2 8 12 18 1 21Z" fill="#ffd77d"><path d="M35 21c-5-2-2-7 0-10 4 6 5 9 0 10Z" fill="#fff3c5"/></Part>
    </>
  ),
  'votive-candle-catholic': (
    <>
      <Part d="M5 37h38v7H5Z" fill="#bcb49b"/>
      <Part d="M18 15h12v26H18Z" fill="#ffe5a5"><path d="M18 18q3 6 5 0v11q4 5 5-2V15h-10Z" fill="#fff2cc"/></Part>
      <path d="M24 12v7" stroke={INK} strokeWidth={1.8}/>
      <Part d="M24 14c-10-3-1-10 0-13 1 4 9 10 0 13Z" fill="#ffd378"/>
      <path d="M9 37V24m29 13V24" stroke="#8b9388" strokeWidth={4}/>
    </>
  ),
  'daruma-eye-painting': (
    <>
      <Part d="M8 31C6 19 11 6 24 5s19 14 17 26c-1 9-8 13-17 13S9 40 8 31Z" fill="#e86953">
        <path d="M32 8c8 7 10 16 9 23-1 9-8 13-17 13 7-4 11-12 11-21 0-6-1-11-3-15Z" fill="#c94e3d" />
      </Part>
      <Part d="M12 18c4-3 20-3 24 0l-2 12c-6 4-14 4-20 0Z" fill="#fff1d5" />
      <path d="m14 20 7-2m6 0 7 2m-18 9 5 1m6 0 5-1" stroke={INK} strokeWidth={2.3} />
      <ellipse cx="19" cy="23" rx="3" ry="3.6" fill={INK} />
      <ellipse cx="29" cy="23" rx="3" ry="3.6" fill="#fffaf0" stroke="#d5ad65" strokeWidth={1.5} />
      <path d="m14 35 3 3m6-2v5m8-6-3 3" stroke="#ffd57f" strokeWidth={2.5} />
    </>
  ),
  mizuhiki: (
    <>
      <Part d="M9 5h30v38H9Z" fill="#fff1d8"><path d="M9 5 24 18 39 5" fill="#f7dfb9" /></Part>
      <Cord d="M9 24h30" color="#e89d78" />
      <Cord d="M24 26C10 24 10 12 18 15c5 2 1 10 6 11 5-1 1-9 6-11 8-3 8 9-6 11Z" color="#d9af64" width={2.8} />
      <Cord d="M24 26c-11 9-16-1-9-4 7-3 6 8 9 4 3 4 2-7 9-4 7 3 2 13-9 4Zm-3 1-7 9m13-9 7 9" color="#e77165" />
    </>
  ),
  milagros: (
    <>
      <Part d="M7 9h34v35H7Z" fill="#cda67c"><path d="M11 13h26v26H11Z" fill="#f7e7c7" /></Part>
      <circle cx="24" cy="17" r="2.5" fill="#d2ab64" stroke={INK} strokeWidth={1.4} />
      <Part d="M24 37C5 25 19 17 24 25c5-8 19 0 0 12Z" fill="#e6bf79">
        <path d="M16 26c-1-4 3-5 5-2" fill="none" stroke="#fff2c7" strokeWidth={2} />
      </Part>
    </>
  ),
  'phuang-malai': (
    <>
      <Part d="M11 22a13 13 0 1 1 26 0 13 13 0 1 1-26 0Zm7 0a6 6 0 1 0 12 0 6 6 0 1 0-12 0Z" fill="#fff3d6" evenodd />
      {Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return <ellipse key={i} cx={24 + Math.cos(a) * 10} cy={22 + Math.sin(a) * 10} rx={2.5} ry={3.3} fill={i % 5 === 0 ? '#f6b4bb' : '#fff9e8'} stroke="#c7b28f" strokeWidth={0.9} transform={`rotate(${i * 30} ${24 + Math.cos(a) * 10} ${22 + Math.sin(a) * 10})`} /> })}
      <Cord d="M20 34v9m8-9v9" color="#f4cc9c" width={3} />
      <ellipse cx="20" cy="43" rx="3.5" ry="2.3" fill="#f6b4bb" stroke={INK} strokeWidth={1.2} />
      <ellipse cx="28" cy="43" rx="3.5" ry="2.3" fill="#f6b4bb" stroke={INK} strokeWidth={1.2} />
    </>
  ),
  // 敲一敲木鱼: a round wooden fish drum on its cushion, the mallet leaning on it.
  woodfish: (
    <>
      <Part d="M5.5 41a17.5 4.5 0 1 0 35 0a17.5 4.5 0 1 0-35 0Z" fill="#e8604f">
        <path d="M5.5 41a17.5 4.5 0 0 0 35 0c-2 2-9.4 3.2-17.5 3.2S7.5 43 5.5 41Z" fill="#c9442d" />
      </Part>
      <Part d="M4 30.5a4.5 4 0 1 0 9 0a4.5 4 0 1 0-9 0Z" fill="#eebd84" />
      <Part d="M7.5 25.5C7.5 16.8 14.4 10.5 23 10.5s15.5 6.3 15.5 15S31.6 40 23 40 7.5 34.2 7.5 25.5Z" fill="#eebd84">
        <path d="M31.5 13.2c4.3 2.7 7 7.1 7 12.3 0 8.5-6.6 14.4-15 14.5 6.7-2.6 10.5-8.2 10.5-14.6 0-4.6-.9-8.7-2.5-12.2Z" fill="#d39a5e" />
        <path d="M12.8 20.5c1.5-3.6 4.6-6.1 8.4-6.8" fill="none" stroke="#fff3df" strokeWidth={2.4} />
        <path d="M12.5 29.5Q23.5 34.5 35.5 28" fill="none" stroke={INK} strokeWidth={2.2} />
        <ellipse cx="12.6" cy="29.4" rx="2.7" ry="2" fill="#5a3a26" />
      </Part>
      <Cord d="M37.6 20.5 44.5 40" color="#c98f5a" width={2.6} />
      <circle cx="36.4" cy="17.4" r="4.4" fill="#e0a96a" stroke={INK} strokeWidth={2.2} />
    </>
  ),
  // 泉边一念: a stone-ringed spring, a golden token falling into it.
  "celtic-folk-spring": (
    <>
      <Part d="M3.5 32c0-6.1 9.2-11 20.5-11s20.5 4.9 20.5 11-9.2 11-20.5 11S3.5 38.1 3.5 32Z" fill="#b5bfa6">
        <path d="M4 34.7C6.5 39.7 14.6 43 24 43s17.5-3.3 20-8.3c-3.6 3.6-11.2 5.9-20 5.9S7.6 38.3 4 34.7Z" fill="#8e9b80" />
        <path d="M9.5 24.2l3.9 2.4M24 21v3.5M38.5 24.2l-3.9 2.4M9.5 39.8l3.9-3.4M38.5 39.8l-3.9-3.4M24 43v-4.5" stroke={INK} strokeWidth={1.4} />
      </Part>
      <Part d="M9 31.5c0-3.9 6.7-7 15-7s15 3.1 15 7-6.7 7-15 7-15-3.1-15-7Z" fill="#4fb3d0">
        <path d="M9.4 33.2c1.6 3.2 7.5 5.3 14.6 5.3s13-2.1 14.6-5.3c-2.9 2-8.4 3.3-14.6 3.3S12.3 35.2 9.4 33.2Z" fill="#2a8fb0" />
        <ellipse cx="24" cy="31.5" rx="7" ry="2.6" fill="none" stroke="#d9f2fc" strokeWidth={1.6} />
      </Part>
      <path d="M19.4 3.5v3.4M28.6 3.5v3.4" stroke="#e0aa25" strokeWidth={1.8} />
      <circle cx="24" cy="13" r="4.8" fill="#f6c453" stroke={INK} strokeWidth={2} />
      <path d="M21.6 11.4a2.6 2.6 0 0 1 2.4-1.6" fill="none" stroke="#fff3cf" strokeWidth={1.4} />
    </>
  ),
  // 花水位一倾: a silver jug pouring a thin stream into a bowl, a petal afloat.
  "theravada-water": (
    <>
      <Part d="M5 30h38c-.9 7.6-8.8 12.8-19 12.8S5.9 37.6 5 30Z" fill="#e8c89a">
        <path d="M34.8 30H43c-.9 7.6-8.8 12.8-19 12.8 6.1-1.8 10.2-6.6 10.8-12.8Z" fill="#c4a882" />
      </Part>
      <Part d="M5 30c0-2 8.5-3.7 19-3.7s19 1.7 19 3.7-8.5 3.7-19 3.7S5 32 5 30Z" fill="#4fb3d0">
        <ellipse cx="28" cy="30.2" rx="4.6" ry="1.4" fill="none" stroke="#d9f2fc" strokeWidth={1.4} />
      </Part>
      {/* A small petal: a finer ink line than the larger parts. */}
      <path d="M12.6 31.4c-2-.4-2.8-2.7-1.4-4 1.4-1.2 3.3-.6 4.2.7.9-1.3 2.8-1.9 4.2-.7 1.4 1.3.6 3.6-1.4 4-1.8.4-3.8.4-5.6 0Z" fill="#ffc4d3" />
      <path d="M15.4 28.1c.9-1.3 2.8-1.9 4.2-.7 1.4 1.3.6 3.6-1.4 4-.9.2-1.9.3-2.8.3Z" fill="#ff9fb8" />
      <path d="M12.6 31.4c-2-.4-2.8-2.7-1.4-4 1.4-1.2 3.3-.6 4.2.7.9-1.3 2.8-1.9 4.2-.7 1.4 1.3.6 3.6-1.4 4-1.8.4-3.8.4-5.6 0Z" fill="none" stroke={INK} strokeWidth={1.4} />
      <Cord d="M29.9 16.8C29.4 21.4 28.8 25.6 28.4 30" color="#8ad0e8" />
      <g transform="rotate(40 17 12)">
        <Part d="M23 8l6.5-1.2-6.5 5.7Z" fill="#c7d1db" />
        <Part d="M11 5.5h12v11a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4Z" fill="#e4eaf0">
          <path d="M19.4 5.5H23v11a4 4 0 0 1-3.6 4Z" fill="#aab7c3" />
        </Part>
        <Part d="M9.8 3.2h14.4a1 1 0 0 1 1 1v1.3H8.8V4.2a1 1 0 0 1 1-1Z" fill="#c7d1db" />
      </g>
    </>
  ),
  // 风铃一响: a glass bell with a painted bloom and its paper strip.
  "furin-wind-chime": (
    <>
      <path d="M24 2.5v7" stroke={INK} strokeWidth={2} />
      <path d="M24 25.5v6.5" stroke={INK} strokeWidth={1.8} />
      <Part d="M13 25.5C13 15.5 17.8 9 24 9s11 6.5 11 16.5Z" fill="#d9f2fc">
        <path d="M28.2 10.5c3.9 2.6 6.5 7.6 6.8 15h-4.8c-.1-6.4-.7-11.1-2-15Z" fill="#a9dcf3" />
        <path d="M17.4 21c.2-3.8 1.9-6.9 4.3-8.4" fill="none" stroke="#fff" strokeWidth={2.2} />
        <circle cx="21.6" cy="20.2" r="2" fill="#ff8f86" />
        <circle cx="26.8" cy="17.4" r="1.5" fill="#ffb08f" />
      </Part>
      <Part d="M19.6 32h8.8v12.4a1.6 1.6 0 0 1-1.6 1.6h-5.6a1.6 1.6 0 0 1-1.6-1.6Z" fill="#ffd3dd">
        <path d="M25.8 32h2.6v12.6a1.4 1.4 0 0 1-1.4 1.4h-1.2Z" fill="#f7adc0" />
      </Part>
    </>
  ),
  // 庭前一礼: a vermilion torii.
  "shinto-torii": (
    <>
      <Part d="M12.5 15h5v28h-5Z" fill="#ef5b3f">
        <path d="M15.6 15h1.9v28h-1.9Z" fill="#c9442d" />
      </Part>
      <Part d="M30.5 15h5v28h-5Z" fill="#ef5b3f">
        <path d="M33.6 15h1.9v28h-1.9Z" fill="#c9442d" />
      </Part>
      <Part d="M8 22h32v4.4H8Z" fill="#ef5b3f">
        <path d="M8 24.8h32v1.6H8Z" fill="#c9442d" />
      </Part>
      <Part d="M3.5 10Q24 5 44.5 10l-1.3 5.4Q24 11 4.8 15.4Z" fill="#ef5b3f">
        <path d="M3.5 10Q24 5 44.5 10l-.5 2.3Q24 7.6 4 12.3Z" fill="#5a3a26" />
        <path d="M4.5 14Q24 9.8 43.5 14l-.3 1.4Q24 11 4.8 15.4Z" fill="#c9442d" />
      </Part>
      <Part d="M11.8 39.4h6.4v4.4h-6.4Z" fill="#5a3a26" />
      <Part d="M29.8 39.4h6.4v4.4h-6.4Z" fill="#5a3a26" />
    </>
  ),
  // 廊前轻转: a prayer drum turning on its axle in a wooden frame.
  "tibetan-wheel": (
    <>
      <path d="M24 8v32" stroke={INK} strokeWidth={2.4} />
      <Part d="M9 4h30a1.5 1.5 0 0 1 1.5 1.5v1.8A1.5 1.5 0 0 1 39 8.8H9a1.5 1.5 0 0 1-1.5-1.5V5.5A1.5 1.5 0 0 1 9 4Z" fill="#c98f5a" />
      <Part d="M9 39.4h30a1.5 1.5 0 0 1 1.5 1.5v1.8a1.5 1.5 0 0 1-1.5 1.5H9a1.5 1.5 0 0 1-1.5-1.5v-1.8A1.5 1.5 0 0 1 9 39.4Z" fill="#c98f5a" />
      <Part d="M12.5 15v18a11.5 3.2 0 0 0 23 0V15Z" fill="#e8604f">
        <path d="M12.5 15a11.5 3.2 0 0 0 23 0v3.6a11.5 3.2 0 0 1-23 0Z" fill="#f6c453" />
        <path d="M12.5 29.4a11.5 3.2 0 0 0 23 0V33a11.5 3.2 0 0 1-23 0Z" fill="#f6c453" />
        <circle cx="17.6" cy="24.6" r="1.6" fill="#f6c453" />
        <circle cx="24" cy="25.4" r="1.6" fill="#f6c453" />
        <circle cx="30.4" cy="24.6" r="1.6" fill="#f6c453" />
        <path d="M30.8 17.7v17.6a11.5 3.2 0 0 0 4.7-2.3V15a11.5 3.2 0 0 1-4.7 2.7Z" fill="#7a2a1a33" />
        <path d="M15.6 21v7" stroke="#ffffffb3" strokeWidth={1.8} />
      </Part>
      <Part d="M12.5 15a11.5 3.2 0 0 1 23 0a11.5 3.2 0 0 1-23 0Z" fill="#ffd97a" />
    </>
  ),
  // 短册系竹: a paper strip tied to a bamboo twig.
  "tanzaku-tanabata": (
    <>
      <Part d="M10.5 5a2.5 2.5 0 0 1 5 0v40.5h-5Z" fill="#8fd17a">
        <path d="M13.8 2.5h1.7v43h-1.7Z" fill="#5aa548" />
      </Part>
      <path d="M10.5 16.5h5M10.5 29.5h5M10.5 41h5" stroke={INK} strokeWidth={1.6} />
      <Cord d="M15 13.5Q28 8 42 9.5" color="#5aa548" />
      <Part d="M33 9.8C35 5.2 39.4 3 44.5 3.6C42.6 8.2 38.2 10.4 33 9.8Z" fill="#8fd17a" />
      <Part d="M15.5 21.5c4-2.6 9-2.4 12 0c-4 2.8-8.9 2.6-12 0Z" fill="#b6e5a6" />
      <g transform="rotate(5 30 11)">
        <path d="M30 11v5.5" stroke={INK} strokeWidth={1.6} />
        <Part d="M25.5 16.5h9V41a1.5 1.5 0 0 1-1.5 1.5h-6a1.5 1.5 0 0 1-1.5-1.5Z" fill="#ffc4d3">
          <path d="M31.8 16.5h2.7V41a1.5 1.5 0 0 1-1.5 1.5h-1.2Z" fill="#ff9fb8" />
          <path d="M29.2 21.5v9M29.2 33.5v3.5" stroke="#c96a84" strokeWidth={1.4} />
        </Part>
      </g>
    </>
  ),
  // 燃灯上浮: a lotus lantern lit from within, drifting up.
  yeondeunghoe: (
    <>
      <circle cx="24" cy="20" r="17" fill="#ffe9a6" opacity={0.55} />
      <Part d="M24 5.5C29 10.5 30 18 24 25C18 18 19 10.5 24 5.5Z" fill="#ffc4d3">
        <path d="M24 7.6C28 12 28.8 18.4 24 24.2Z" fill="#ff9fb8" />
      </Part>
      <Part d="M24 27C16.5 26.5 10 21 9 13C16.5 14 22 19 24 27Z" fill="#ffc4d3" />
      <Part d="M24 27C31.5 26.5 38 21 39 13C31.5 14 26 19 24 27Z" fill="#ff9fb8" />
      <ellipse cx="24" cy="20.8" rx="3.2" ry="4" fill="#ffe28a" stroke={INK} strokeWidth={1.6} />
      <Part d="M10.5 33.5C14.5 30.8 33.5 30.8 37.5 33.5C33.5 37.8 14.5 37.8 10.5 33.5Z" fill="#8fd17a">
        <path d="M24 31.6C30 31.6 34.6 32.3 37.4 33.6C35.6 35.6 31 36.8 25 37Z" fill="#5aa548" />
      </Part>
      <Part d="M12.5 23C13.5 30 18.5 33.4 24 33.4S34.5 30 35.5 23C31.5 26.2 27.8 27.4 24 27.4S16.5 26.2 12.5 23Z" fill="#ffc4d3">
        <path d="M24 27.4C27.8 27.4 31.5 26.2 35.5 23C34.5 30 29.5 33.4 24 33.4Z" fill="#ff9fb8" />
        <path d="M24 28.4v4" stroke="#e2769a" strokeWidth={1.4} />
      </Part>
      <path d="M17 40.5v3M24 39.5v5M31 40.5v3" stroke="#e0aa25" strokeWidth={2.2} />
    </>
  ),
  // 折一只纸鹤: a sakura-paper crane, head to the left.
  crane: (
    <>
      <Part d="M24 25.5L32.5 3.5L33 27Z" fill="#ff9fb8" />
      <Part d="M29 30L45 15.5L42.6 14.4L27 27Z" fill="#ffc4d3" />
      <Part d="M20 29L6.5 17L9 15.6L23 26.5Z" fill="#ffc4d3" />
      <Part d="M6.4 17.2L9.2 15.4L3.4 22Z" fill="#ffc4d3" />
      <Part d="M12.5 31L24 23.5L35.5 31L24 36.5Z" fill="#ffc4d3">
        <path d="M12.5 31h23L24 36.5Z" fill="#ff9fb8" />
      </Part>
      <Part d="M17.5 29.5L14.5 4.5L31 27Z" fill="#ffc4d3">
        <path d="M17.5 29.5L16 17L31 27Z" fill="#ffb3c7" />
      </Part>
    </>
  ),
  // 月下一灯: a lit paper lantern with its wish plaque.
  lantern: (
    <>
      <path d="M24 2v6" stroke="#c8453a" strokeWidth={2} />
      <Part d="M17 11.5C11.5 15 11.5 29 17 32.5h14c5.5-3.5 5.5-17.5 0-21Z" fill="#ffc46b">
        <path d="M28.6 11.5H31c5.5 3.5 5.5 17.5 0 21h-2.4c4-3.5 4-17.5 0-21Z" fill="#f2a145" />
        <path d="M13.4 17.2Q24 19 34.6 17.2M12.8 22Q24 23.8 35.2 22M13.4 26.8Q24 28.6 34.6 26.8" fill="none" stroke="#d9893a" strokeWidth={1.2} />
        <ellipse cx="19.8" cy="19.2" rx="2.4" ry="4" fill="#fff3cf" />
      </Part>
      <Part d="M16 7.5h16a1.2 1.2 0 0 1 1.2 1.2v2.6a1.2 1.2 0 0 1-1.2 1.2H16a1.2 1.2 0 0 1-1.2-1.2V8.7A1.2 1.2 0 0 1 16 7.5Z" fill="#5a3a26" />
      <Part d="M16 31.5h16a1.2 1.2 0 0 1 1.2 1.2v2.6a1.2 1.2 0 0 1-1.2 1.2H16a1.2 1.2 0 0 1-1.2-1.2v-2.6a1.2 1.2 0 0 1 1.2-1.2Z" fill="#5a3a26" />
      <path d="M24 36.5V39" stroke="#c8453a" strokeWidth={1.6} />
      <Part d="M20.5 39h7v6.4a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1Z" fill="#e8c89a" />
    </>
  ),
  // 火边花环: a flower wreath round a candle, ribbons trailing.
  "slavic-wreath": (
    <>
      <Cord d="M21 34c-.6 4.4-4.4 4.6-5.2 9.4M27 34c.6 4.4 4.4 4.6 5.2 9.4" color="#ff7a6b" />
      <Part d="M24 5.5a16 16 0 1 0 0 32a16 16 0 1 0 0-32ZM24 13a8.5 8.5 0 1 1 0 17a8.5 8.5 0 1 1 0-17Z" fill="#8fd17a" evenodd>
        <circle cx="24" cy="21.5" r="12.2" fill="none" stroke="#5aa548" strokeWidth={3} strokeDasharray="2.4 3.4" />
      </Part>
      {(
        [
          [24, 9.3, "#ff7a6b"],
          [34.6, 15.4, "#ffd966"],
          [34.6, 27.6, "#8fd0f5"],
          [24, 33.7, "#fffdf7"],
          [13.4, 27.6, "#ff9fb8"],
          [13.4, 15.4, "#ffd966"],
        ] as const
      ).map(([cx, cy, color]) => (
        <g key={`${cx},${cy}`}>
          <circle cx={cx} cy={cy} r={2.9} fill={color} stroke={INK} strokeWidth={1.4} />
          <circle cx={cx} cy={cy} r={1} fill="#e0aa25" />
        </g>
      ))}
      <Part d="M22.2 19h3.6v8h-3.6Z" fill="#fff3cf" />
      <path d="M24 12.6c1.7 1.7 2 3.6 0 5.2c-2-1.6-1.7-3.5 0-5.2Z" fill="#ffb347" stroke={INK} strokeWidth={1.2} />
    </>
  ),
};

/** Whether a scene has its own drawn icon. */
export function hasSceneIcon(id: string): boolean {
  return id in sceneIcons;
}

/** The scene's drawn icon (decorative), or nothing for a scene without one. */
export function SceneIcon({ id }: { id: string }) {
  const art = sceneIcons[id];
  if (!art) return null;
  return (
    <svg
      className="scene-icon"
      viewBox="0 0 48 48"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {art}
    </svg>
  );
}

/**
 * A scene's badge in a list row (场景目录, 心愿): its drawn icon on a light tint,
 * ringed in the scene's candy (keyed by data-scene in style.css). A scene
 * without a drawn icon (a new remote one) shows a leaf, so no row is blank.
 */
export function SceneBadge({ id }: { id: string }) {
  return (
    <span className="scene-badge" data-scene={id} aria-hidden="true">
      {hasSceneIcon(id) ? <SceneIcon id={id} /> : <Icon name="leaf" />}
    </span>
  );
}

/** A scene icon in the same 76px item slot as the small illustration crops. */
export function SceneArt({ id }: { id: string }) {
  return (
    <div className="art art-small scene-art" data-scene={id} aria-hidden="true">
      {hasSceneIcon(id) ? <SceneIcon id={id} /> : <Icon name="leaf" />}
    </div>
  );
}
