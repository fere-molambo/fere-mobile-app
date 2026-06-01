/*
  # Add Profile ENUM Types
  
  1. New ENUM Types
    - `sexe` - Homme, Femme
    - `tranche_age` - 18-25, 26-35, 36-45, 46-55, 55+
    - `statut_matrimonial` - Célibataire, Marié, Divorcé, Veuf
    - `statut_professionnel` - Étudiant, Salarié, Entrepreneur, Sans emploi, Retraité
    - `piece_identite_client_type` - Carte d'étudiant, CNI, Passeport, Permis de conduire
  
  2. Updates
    - Alter columns in profiles table to use new ENUM types where text is currently used
  
  3. Notes
    - Uses IF NOT EXISTS to prevent errors if types already exist
    - Safely converts existing text columns to ENUM types
*/

DO $$ 
BEGIN
  -- Create sexe ENUM type if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sexe') THEN
    CREATE TYPE sexe AS ENUM ('homme', 'femme');
  END IF;

  -- Create tranche_age ENUM type if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tranche_age') THEN
    CREATE TYPE tranche_age AS ENUM ('18-25', '26-35', '36-45', '46-55', '55+');
  END IF;

  -- Create statut_matrimonial ENUM type if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'statut_matrimonial') THEN
    CREATE TYPE statut_matrimonial AS ENUM ('celibataire', 'marie', 'divorce', 'veuf');
  END IF;

  -- Create statut_professionnel ENUM type if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'statut_professionnel') THEN
    CREATE TYPE statut_professionnel AS ENUM ('etudiant', 'salarie', 'entrepreneur', 'sans_emploi', 'retraite');
  END IF;

  -- Create piece_identite_client_type ENUM type if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'piece_identite_client_type') THEN
    CREATE TYPE piece_identite_client_type AS ENUM ('carte_etudiant', 'cni', 'passeport', 'permis_conduire');
  END IF;
END $$;

-- Alter columns to use ENUM types (only if column type is not already the ENUM type)
DO $$
BEGIN
  -- Update sexe column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'sexe' AND data_type != 'USER-DEFINED'
  ) THEN
    ALTER TABLE profiles ALTER COLUMN sexe TYPE sexe USING sexe::sexe;
  END IF;

  -- Update tranche_age column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'tranche_age' AND data_type != 'USER-DEFINED'
  ) THEN
    ALTER TABLE profiles ALTER COLUMN tranche_age TYPE tranche_age USING tranche_age::tranche_age;
  END IF;

  -- Update statut_matrimonial column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'statut_matrimonial' AND data_type != 'USER-DEFINED'
  ) THEN
    ALTER TABLE profiles ALTER COLUMN statut_matrimonial TYPE statut_matrimonial USING statut_matrimonial::statut_matrimonial;
  END IF;

  -- Update statut_professionnel column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'statut_professionnel' AND data_type != 'USER-DEFINED'
  ) THEN
    ALTER TABLE profiles ALTER COLUMN statut_professionnel TYPE statut_professionnel USING statut_professionnel::statut_professionnel;
  END IF;

  -- Update piece_identite_client_type column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'piece_identite_client_type' AND data_type != 'USER-DEFINED'
  ) THEN
    ALTER TABLE profiles ALTER COLUMN piece_identite_client_type TYPE piece_identite_client_type USING piece_identite_client_type::piece_identite_client_type;
  END IF;
END $$;
