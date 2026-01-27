import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://jqdqkkpgszjrvwliaxxj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxZHFra3Bnc3pqcnZ3bGlheHhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MTQ0ODcsImV4cCI6MjA4NDk5MDQ4N30.7AuzUcBe5Bd-HF6wEh2ISKPAg22UDpVEooJD3EzczTI'
);

// Generate dummy 1024-dimension embedding
const dummyEmbedding = Array(1024).fill(0.01);

const { data, error } = await supabase
  .rpc('search_docs', {
    query_embedding: dummyEmbedding,
    match_count: 3,
  });

if (error) {
  console.log('Error:', JSON.stringify(error, null, 2));
} else {
  console.log('Success! Results:', JSON.stringify(data, null, 2));
}
