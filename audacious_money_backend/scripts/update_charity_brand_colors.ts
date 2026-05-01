/**
 * Script to update charity brand colors
 * Populates preliminary brand colors for the 5 NPOs based on research
 */

import { supabase } from '../supabase/client';

interface CharityColorUpdate {
  name: string;
  brandColorBackground: string;
  brandColorTitle: string;
  brandColorDescription: string;
}

const charityColors: CharityColorUpdate[] = [
  {
    name: 'Built Oregon',
    brandColorBackground: '#333333', // Dark charcoal/gray
    brandColorTitle: '#FFFFFF', // White
    brandColorDescription: '#FFFFFF', // White
  },
  {
    name: 'Hot Mess Express',
    brandColorBackground: '#2D5F3F', // Dark green from logo
    brandColorTitle: '#FFFFFF', // White
    brandColorDescription: '#E89B8F', // Muted coral accent
  },
  {
    name: 'NAYA Family and Youth',
    brandColorBackground: '#4d65ff', // Blue from website
    brandColorTitle: '#FFFFFF', // White
    brandColorDescription: '#FFFFFF', // White
  },
  {
    name: 'Feed 7 Generations',
    brandColorBackground: '#8B6F47', // Earth tone brown/tan
    brandColorTitle: '#FFFFFF', // White
    brandColorDescription: '#FFFFFF', // White
  },
  {
    name: 'Senior Dog Rescue of Oregon',
    brandColorBackground: '#4BA9A0', // Teal from website
    brandColorTitle: '#FFFFFF', // White
    brandColorDescription: '#FFFFFF', // White
  },
];

async function updateCharityColors() {
  console.log('Starting charity brand color updates...\n');

  for (const charity of charityColors) {
    try {
      // Find charity by name
      const { data: existingCharity, error: fetchError } = await supabase
        .from('charities')
        .select('id, name')
        .eq('name', charity.name)
        .single();

      if (fetchError || !existingCharity) {
        console.log(`❌ Charity not found: ${charity.name}`);
        continue;
      }

      // Update brand colors
      const { error: updateError } = await supabase
        .from('charities')
        .update({
          brandColorBackground: charity.brandColorBackground,
          brandColorTitle: charity.brandColorTitle,
          brandColorDescription: charity.brandColorDescription,
          updated_at: Date.now(),
        })
        .eq('id', existingCharity.id);

      if (updateError) {
        console.log(`❌ Failed to update ${charity.name}:`, updateError.message);
      } else {
        console.log(`✅ Updated ${charity.name}:`);
        console.log(`   Background: ${charity.brandColorBackground}`);
        console.log(`   Title: ${charity.brandColorTitle}`);
        console.log(`   Description: ${charity.brandColorDescription}\n`);
      }
    } catch (error) {
      console.error(`❌ Error updating ${charity.name}:`, error);
    }
  }

  console.log('\n✨ Charity brand color updates complete!');
}

// Run the script
updateCharityColors()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
