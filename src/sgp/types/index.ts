export interface SgpUser {
  id: string;
  phone: string;
  display_name: string;
  avatar_url: string;
  nfc_token: string | null;
  is_verified: boolean;
  status: 'active' | 'suspended' | 'dormant';
  birth_date: string | null;
  gender_code: string | null;
  address: string;
  address_detail: string;
  kyc_level: number;
  ci_hash: string | null;
  phone_verified_at: string | null;
  created_at: string;
}

export interface SgpComplexMembership {
  id: string;
  user_id: string;
  complex_id: string;
  unit_number: string;
  building_dong: string;
  role: 'resident' | 'owner' | 'tenant';
  request_status: 'pending' | 'approved' | 'rejected';
  requested_by: 'user' | 'admin';
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  complex?: { id: string; name: string; address: string };
}

export interface SgpCoinWallet {
  id: string;
  user_id: string;
  balance: number;
  lifetime_charged: number;
  lifetime_spent: number;
  auto_charge_enabled: boolean;
  auto_charge_threshold: number;
  auto_charge_amount: number;
  status: 'active' | 'frozen';
  created_at: string;
}

export interface SgpCoinTransaction {
  id: string;
  wallet_id: string;
  user_id: string;
  type: 'charge' | 'payment' | 'refund' | 'bonus';
  amount: number;
  balance_after: number;
  description: string;
  reference_type: string;
  reference_id: string;
  created_at: string;
}

export interface SgpParkingPayment {
  id: string;
  user_id: string;
  complex_id: string;
  vehicle_plate: string;
  entry_at: string;
  exit_at: string | null;
  duration_minutes: number;
  amount_coins: number;
  payment_method: 'nfc_tag' | 'auto_deduct' | 'manual';
  nfc_terminal_id: string;
  status: 'pending' | 'completed' | 'refunded';
  created_at: string;
}
