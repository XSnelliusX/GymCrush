import { MuscleGroup } from '../../types/gym';

export interface MachinePreset {
  id: string;
  nameEn: string;
  nameZh: string;
  muscleGroup: MuscleGroup;
  uri: string;
  locationEn: string;
  locationZh: string;
  adj1En: string;
  adj1Zh: string;
  adj2En: string;
  adj2Zh: string;
  markusSeat: string;
  markusPin: string;
  partnerSeat: string;
  partnerPin: string;
}

export const MACHINE_PRESETS: MachinePreset[] = [
  {
    id: 'preset-chest',
    nameEn: 'Iso-Lateral Incline Chest Press',
    nameZh: '上斜獨立胸推機',
    muscleGroup: 'Chest',
    uri: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=800&auto=format&fit=crop&q=80',
    locationEn: 'Plate-loaded chest bay',
    locationZh: '槓片胸推區',
    adj1En: 'Seat Height',
    adj1Zh: '座椅高度',
    adj2En: 'Back Pad',
    adj2Zh: '背墊位置',
    markusSeat: '5',
    markusPin: '4',
    partnerSeat: '2',
    partnerPin: '2',
  },
  {
    id: 'preset-back',
    nameEn: 'Diverging Lat Pulldown',
    nameZh: '滑輪高拉機',
    muscleGroup: 'Back',
    uri: 'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?w=800&auto=format&fit=crop&q=80',
    locationEn: 'Cable tower row',
    locationZh: '纜繩滑輪區',
    adj1En: 'Thigh Pad',
    adj1Zh: '腿部固定墊',
    adj2En: 'Pin / Handle',
    adj2Zh: '插銷 / 握把',
    markusSeat: '4',
    markusPin: '6',
    partnerSeat: '2',
    partnerPin: '3',
  },
  {
    id: 'preset-legs',
    nameEn: '45° Linear Leg Press',
    nameZh: '45度斜蹬腿推機',
    muscleGroup: 'Legs',
    uri: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80',
    locationEn: 'Lower body platform',
    locationZh: '下肢訓練區',
    adj1En: 'Backrest Angle',
    adj1Zh: '椅背角度',
    adj2En: 'Safety Stop',
    adj2Zh: '安全插銷',
    markusSeat: '3',
    markusPin: '2',
    partnerSeat: '1',
    partnerPin: '1',
  },
  {
    id: 'preset-glutes',
    nameEn: 'Seated Glute Drive',
    nameZh: '臀推訓練機',
    muscleGroup: 'Glutes',
    uri: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=800&auto=format&fit=crop&q=80',
    locationEn: 'Glute & turf zone',
    locationZh: '臀部訓練草皮區',
    adj1En: 'Back Pad',
    adj1Zh: '靠背位置',
    adj2En: 'Footplate',
    adj2Zh: '踏板位置',
    markusSeat: '4',
    markusPin: '3',
    partnerSeat: '2',
    partnerPin: '1',
  },
  {
    id: 'preset-shoulders',
    nameEn: 'Converging Shoulder Press',
    nameZh: '坐姿肩推機',
    muscleGroup: 'Shoulders',
    uri: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=800&auto=format&fit=crop&q=80',
    locationEn: 'Selectorized row B',
    locationZh: '插銷器械 B 區',
    adj1En: 'Seat Height',
    adj1Zh: '座椅高度',
    adj2En: 'Range Limiter',
    adj2Zh: '起始角度插銷',
    markusSeat: '5',
    markusPin: '3',
    partnerSeat: '2',
    partnerPin: '1',
  },
  {
    id: 'preset-arms',
    nameEn: 'Dual Adjustable Cable Column',
    nameZh: '雙邊可調式龍門架',
    muscleGroup: 'Arms',
    uri: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80',
    locationEn: 'Functional cable bridge',
    locationZh: '多功能龍門架區',
    adj1En: 'Pulley Height',
    adj1Zh: '滑輪高度',
    adj2En: 'Attachment',
    adj2Zh: '握把配件',
    markusSeat: '7',
    markusPin: '4',
    partnerSeat: '5',
    partnerPin: '2',
  },
];
