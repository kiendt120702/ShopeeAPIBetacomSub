import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InviteMemberRequest {
  shop_id: number
  email: string
  role?: 'member' | 'admin'
}

interface RemoveMemberRequest {
  shop_id: number
  user_id: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Get user from JWT token
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const method = req.method

    // Route: POST /shop-members/invite - Invite member to shop
    if (method === 'POST' && url.pathname.endsWith('/invite')) {
      const { shop_id, email, role = 'member' }: InviteMemberRequest = await req.json()

      // Validate input
      if (!shop_id || !email) {
        return new Response(
          JSON.stringify({ error: 'shop_id and email are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if current user is admin of the shop
      const { data: adminCheck } = await supabaseClient
        .from('apishopee_shop_members')
        .select('role')
        .eq('shop_id', shop_id)
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single()

      if (!adminCheck) {
        return new Response(
          JSON.stringify({ error: 'Only shop admins can invite members' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Find user by email
      const { data: targetUser, error: userError } = await supabaseClient
        .from('sys_profiles')
        .select('id, email, full_name')
        .eq('email', email.toLowerCase())
        .single()

      if (userError || !targetUser) {
        return new Response(
          JSON.stringify({ error: 'User not found with this email' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if user is already a member
      const { data: existingMember } = await supabaseClient
        .from('apishopee_shop_members')
        .select('role')
        .eq('shop_id', shop_id)
        .eq('user_id', targetUser.id)
        .single()

      if (existingMember) {
        return new Response(
          JSON.stringify({ 
            error: 'User is already a member of this shop',
            current_role: existingMember.role 
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Add user as member
      const { data: newMember, error: insertError } = await supabaseClient
        .from('apishopee_shop_members')
        .insert({
          shop_id,
          user_id: targetUser.id,
          role
        })
        .select(`
          id,
          role,
          created_at,
          user_id,
          sys_profiles!inner(email, full_name, avatar_url)
        `)
        .single()

      if (insertError) {
        return new Response(
          JSON.stringify({ error: 'Failed to add member', details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          member: newMember,
          message: `${targetUser.full_name || targetUser.email} has been added as ${role}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Route: DELETE /shop-members/remove - Remove member from shop
    if (method === 'DELETE' && url.pathname.endsWith('/remove')) {
      const { shop_id, user_id }: RemoveMemberRequest = await req.json()

      // Validate input
      if (!shop_id || !user_id) {
        return new Response(
          JSON.stringify({ error: 'shop_id and user_id are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if current user is admin of the shop
      const { data: adminCheck } = await supabaseClient
        .from('apishopee_shop_members')
        .select('role')
        .eq('shop_id', shop_id)
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single()

      if (!adminCheck) {
        return new Response(
          JSON.stringify({ error: 'Only shop admins can remove members' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Prevent admin from removing themselves if they're the only admin
      if (user_id === user.id) {
        const { count: adminCount } = await supabaseClient
          .from('apishopee_shop_members')
          .select('*', { count: 'exact', head: true })
          .eq('shop_id', shop_id)
          .eq('role', 'admin')

        if (adminCount === 1) {
          return new Response(
            JSON.stringify({ error: 'Cannot remove the only admin. Transfer admin role first.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      // Remove member
      const { error: deleteError } = await supabaseClient
        .from('apishopee_shop_members')
        .delete()
        .eq('shop_id', shop_id)
        .eq('user_id', user_id)

      if (deleteError) {
        return new Response(
          JSON.stringify({ error: 'Failed to remove member', details: deleteError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Member removed successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Route: GET /shop-members?shop_id=123 - Get shop members
    if (method === 'GET') {
      const shop_id = parseInt(url.searchParams.get('shop_id') || '')

      if (!shop_id || isNaN(shop_id)) {
        return new Response(
          JSON.stringify({ error: 'shop_id parameter is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if user has access to this shop
      const { data: memberCheck } = await supabaseClient
        .from('apishopee_shop_members')
        .select('role')
        .eq('shop_id', shop_id)
        .eq('user_id', user.id)
        .single()

      if (!memberCheck) {
        return new Response(
          JSON.stringify({ error: 'Access denied to this shop' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get all shop members
      const { data: members, error: membersError } = await supabaseClient
        .from('shop_member_details')
        .select('*')
        .eq('shop_id', shop_id)
        .order('role', { ascending: false }) // Admins first
        .order('created_at', { ascending: true })

      if (membersError) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch members', details: membersError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ 
          members,
          current_user_role: memberCheck.role,
          can_manage: memberCheck.role === 'admin'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Route: PUT /shop-members/role - Update member role
    if (method === 'PUT' && url.pathname.endsWith('/role')) {
      const { shop_id, user_id, new_role } = await req.json()

      // Validate input
      if (!shop_id || !user_id || !new_role || !['admin', 'member'].includes(new_role)) {
        return new Response(
          JSON.stringify({ error: 'shop_id, user_id, and valid new_role are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if current user is admin
      const { data: adminCheck } = await supabaseClient
        .from('apishopee_shop_members')
        .select('role')
        .eq('shop_id', shop_id)
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single()

      if (!adminCheck) {
        return new Response(
          JSON.stringify({ error: 'Only admins can change member roles' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Update role
      const { error: updateError } = await supabaseClient
        .from('apishopee_shop_members')
        .update({ role: new_role })
        .eq('shop_id', shop_id)
        .eq('user_id', user_id)

      if (updateError) {
        return new Response(
          JSON.stringify({ error: 'Failed to update role', details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, message: `Role updated to ${new_role}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Route not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})