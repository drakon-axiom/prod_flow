import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const ids = {
  admin: '00000000-0000-0000-0000-000000000001',
  operator: '00000000-0000-0000-0000-000000000002',
  inactive: '00000000-0000-0000-0000-000000000003',
  unknown: '00000000-0000-0000-0000-000000000004',
  secondAdmin: '00000000-0000-0000-0000-000000000005',
};

test('actual PostgreSQL permissions and production commands', async (t) => {
  const db = new PGlite();
  const scalar = async (sql, values = []) => Object.values((await db.query(sql, values)).rows[0])[0];
  async function as(identity) {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [ids[identity] ?? '']);
    await db.exec(identity === 'anon' ? 'SET ROLE anon' : 'SET ROLE authenticated');
  }
  async function denied(sql, args = [], code) {
    await assert.rejects(db.query(sql, args), (error) => {
      if (code) assert.equal(error.code, code);
      return true;
    });
  }
  try {
    await db.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY, banned_until timestamptz, deleted_at timestamptz);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO anon,authenticated;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
    `);
    const migrations = new URL('../supabase/migrations/', import.meta.url);
    for (const file of (await readdir(migrations)).filter((f) => f.endsWith('.sql')).sort()) {
      if (file.startsWith('016_')) {
        // Exercise remediation of both table and column grants from an existing install.
        await db.exec(`
          GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated;
          GRANT UPDATE(role,is_active) ON public.profiles TO authenticated;
          GRANT UPDATE(status) ON public.production_runs TO authenticated;
        `);
      }
      await db.exec(await readFile(new URL(file, migrations), 'utf8'));
    }
    await db.exec(`
      INSERT INTO auth.users(id) VALUES
        ('${ids.admin}'),('${ids.operator}'),('${ids.inactive}'),('${ids.unknown}'),('${ids.secondAdmin}');
      INSERT INTO public.profiles(id,name,role,is_active) VALUES
        ('${ids.admin}','Admin','admin',true),
        ('${ids.operator}','Operator','operator',true),
        ('${ids.inactive}','Disabled','admin',false),
        ('${ids.secondAdmin}','Second admin','admin',true);
    `);
    const formula = await scalar("INSERT INTO public.formulas(name,product_name) VALUES ('Fixture','Fixture product') RETURNING id");
    const version = await scalar("INSERT INTO public.formula_versions(formula_id,version_number,base_batch_size,base_batch_unit) VALUES ($1,1,10,'L') RETURNING id", [formula]);
    const otherFormula = await scalar("INSERT INTO public.formulas(name,product_name) VALUES ('Other','Other') RETURNING id");
    const otherVersion = await scalar("INSERT INTO public.formula_versions(formula_id,version_number,base_batch_size,base_batch_unit) VALUES ($1,1,10,'L') RETURNING id", [otherFormula]);
    const step = await scalar("INSERT INTO public.formula_steps(formula_version_id,step_number,title,requires_confirmation,requires_quantity_entry,sort_order) VALUES ($1,1,'Test step',true,true,5) RETURNING id", [version]);
    await db.query(`INSERT INTO public.formula_step_fields(formula_step_id,label,field_type,is_required,options,sort_order) VALUES
      ($1,'Confirm','checkbox',true,null,0),
      ($1,'Reading','number',true,'{"min":4,"max":8}',1),
      ($1,'Choice','select',true,'{"options":["Yes","No"]}',2),
      ($1,'Notes','text',true,null,3)`, [step]);

    await t.test('Edge service can provision inactive staff and append audit; clients and service cannot rewrite audit', async () => {
      const provisioned='00000000-0000-0000-0000-000000000010';
      await db.query('INSERT INTO auth.users(id) VALUES ($1)',[provisioned]);
      // Supabase installations can inherit broad service-role table defaults.
      // The new audit table must explicitly remove dangerous write grants.
      for (const identity of ['anon','operator']) {
        await as(identity);
        await denied("INSERT INTO public.security_events(actor_id,action,target_id) VALUES ($1,'forged',$2)",[ids.admin,provisioned],'42501');
      }
      await db.exec('RESET ROLE; SET ROLE service_role');
      await db.query("INSERT INTO public.profiles(id,name,role,is_active) VALUES ($1,'Provisioned','operator',false)",[provisioned]);
      await db.query("INSERT INTO public.security_events(actor_id,action,target_id) VALUES ($1,'user.created_inactive',$2)",[ids.admin,provisioned]);
      await denied("UPDATE public.security_events SET action='rewritten'",[],'42501');
      await denied('DELETE FROM public.security_events',[],'42501');
      await denied('TRUNCATE public.security_events',[],'42501');
      await db.exec('RESET ROLE');
      assert.equal(await scalar('SELECT is_active FROM public.profiles WHERE id=$1',[provisioned]),false);
      assert.equal(await scalar("SELECT count(*) FROM public.security_events WHERE action='user.created_inactive' AND target_id=$1",[provisioned]),1);
    });

    await t.test('anonymous, missing staff and inactive sessions cannot read operations or invoke workflows', async () => {
      await as('anon');
      await denied('SELECT * FROM public.production_runs', [], '42501');
      for (const sql of [
        'SELECT public.get_user_role()',
        'SELECT public.start_production_run(null)',
        'SELECT public.calculate_batch(null,1)',
        'SELECT public.complete_run_step(null,null)',
        "SELECT public.change_run_status(null,'paused')",
        'SELECT public.admin_update_profile(null)',
      ]) await denied(sql, [], '42501');
      for (const identity of ['unknown','inactive']) {
        await as(identity);
        assert.equal(await scalar('SELECT count(*) FROM public.formulas'), 0);
        assert.equal(await scalar('SELECT count(*) FROM public.profiles'), 0);
        assert.equal(await scalar('SELECT public.get_user_role()'), null);
        await denied('SELECT public.start_production_run(null)', [], '42501');
        await denied('SELECT public.calculate_batch($1,1)', [version], '42501');
        await denied('SELECT public.complete_run_step(null,null)', [], '42501');
        await denied("SELECT public.change_run_status(null,'paused')", [], '42501');
        await denied('SELECT public.admin_update_profile($1)', [ids.operator], '42501');
      }
    });

    await t.test('personal name edit works but authority fields require an audited active administrator', async () => {
      await as('operator');
      await db.query("UPDATE public.profiles SET name='Updated name' WHERE id=$1", [ids.operator]);
      assert.equal(await scalar('SELECT name FROM public.profiles WHERE id=$1', [ids.operator]), 'Updated name');
      await denied("UPDATE public.profiles SET role='admin' WHERE id=$1", [ids.operator], '42501');
      await denied('UPDATE public.profiles SET is_active=true WHERE id=$1', [ids.operator], '42501');
      await denied("SELECT public.admin_update_profile($1,null,'admin')", [ids.operator], '42501');
      await as('admin');
      await denied("UPDATE public.profiles SET role='admin' WHERE id=$1", [ids.operator], '42501');
      await db.query("SELECT public.admin_update_profile($1,'Changed by admin','operator',true)", [ids.operator]);
      assert.equal(await scalar("SELECT count(*) FROM public.security_events WHERE action='profile_updated'"), 1);
      await denied("SELECT public.admin_update_profile($1,null,'operator')", [ids.admin]);
      await db.query('SELECT public.admin_update_profile($1,null,null,false)', [ids.operator]);
      await as('operator');
      assert.equal(await scalar('SELECT count(*) FROM public.formulas'), 0);
      assert.equal((await db.query("UPDATE public.profiles SET name='Still disabled' WHERE id=$1 RETURNING id", [ids.operator])).rows.length, 0);
      await as('admin');
      await db.query('SELECT public.admin_update_profile($1,null,null,true)', [ids.operator]);
    });

    await t.test('Auth ban and soft deletion revoke old-JWT database access; expired ban permits active staff', async () => {
      for (const identity of ['operator','secondAdmin']) {
        for (const state of ['banned','deleted']) {
          await db.exec('RESET ROLE');
          await db.query(state==='banned'
            ? "UPDATE auth.users SET banned_until=now()+interval '1 day' WHERE id=$1"
            : 'UPDATE auth.users SET deleted_at=now() WHERE id=$1',[ids[identity]]);
          // Simulate an already-issued, otherwise valid JWT with the same subject.
          await as(identity);
          assert.equal(await scalar('SELECT public.get_user_role()'),null);
          assert.equal(await scalar('SELECT count(*) FROM public.formulas'),0);
          assert.equal(await scalar('SELECT count(*) FROM public.production_queue'),0);
          await denied('SELECT public.start_production_run(null)',[],'42501');
          await denied('SELECT public.calculate_batch($1,1)',[version],'42501');
          await denied('SELECT public.complete_run_step(null,null)',[],'42501');
          await denied("SELECT public.change_run_status(null,'paused')",[],'42501');
          await denied('SELECT public.admin_update_profile($1)',[ids.operator],'42501');
          await db.exec('RESET ROLE');
          await db.query('UPDATE auth.users SET banned_until=null,deleted_at=null WHERE id=$1',[ids[identity]]);
        }
      }
      await db.query("UPDATE auth.users SET banned_until=now()-interval '1 second' WHERE id=$1",[ids.operator]);
      await as('operator');
      assert.equal(await scalar('SELECT public.get_user_role()'),'operator');
      await db.exec('RESET ROLE');
      await db.query('UPDATE auth.users SET banned_until=null WHERE id=$1',[ids.operator]);
    });

    await t.test('access changes hold a shared transaction lock and stale administrators cannot remove the remaining admin', async () => {
      await as('admin');
      await db.exec('BEGIN');
      try {
        await db.query('SELECT public.admin_update_profile($1,$2)',[ids.secondAdmin,'Second admin']);
        const locks=await db.query("SELECT 1 FROM pg_locks WHERE locktype='advisory' AND objid=72390402 AND granted");
        assert.ok(locks.rows.length>0,'The shared access-change lock must remain held until commit');
        await db.exec('COMMIT');
      } catch(error) { await db.exec('ROLLBACK'); throw error; }
      await db.query("SELECT public.admin_update_profile($1,null,'operator')",[ids.secondAdmin]);
      await as('secondAdmin');
      await denied("SELECT public.admin_update_profile($1,null,'operator')",[ids.admin],'42501');
      await as('admin');
      await denied("SELECT public.admin_update_profile($1,null,'operator')",[ids.admin]);
      await db.query("SELECT public.admin_update_profile($1,null,'admin')",[ids.secondAdmin]);
      for (const state of ['banned','deleted','inactive']) {
        await db.exec('RESET ROLE');
        if(state==='inactive') await db.query('UPDATE public.profiles SET is_active=false WHERE id=$1',[ids.secondAdmin]);
        else await db.query(state==='banned'
          ? "UPDATE auth.users SET banned_until=now()+interval '1 day' WHERE id=$1"
          : 'UPDATE auth.users SET deleted_at=now() WHERE id=$1',[ids.secondAdmin]);
        await as('admin');
        await assert.rejects(db.query("SELECT public.admin_update_profile($1,null,'operator')",[ids.admin]),/eligible active administrator/);
        await db.exec('RESET ROLE');
        await db.query('UPDATE auth.users SET banned_until=null,deleted_at=null WHERE id=$1',[ids.secondAdmin]);
        await db.query('UPDATE public.profiles SET is_active=true WHERE id=$1',[ids.secondAdmin]);
      }
    });

    let queue, run, runStep, fields, validInputs;
    const complete = (inputs, confirmed = true, quantity = 10, actor = null) =>
      db.query('SELECT public.complete_run_step($1,$2,$3,$4::jsonb,$5,$6)', [run,runStep,actor,JSON.stringify(inputs),confirmed,quantity]);
    await t.test('active operator can queue, preview and start; actor spoofing and mismatched formula versions fail', async () => {
      await as('operator');
      const preview = await scalar('SELECT public.calculate_batch($1,20)', [version]);
      assert.equal(preview.scale_factor, 2);
      await denied('SELECT public.calculate_batch($1,$2)', [version, 'NaN']);
      queue = await scalar("INSERT INTO public.production_queue(formula_id,formula_version_id,batch_size,batch_unit,requested_by) VALUES ($1,$2,10,'L',$3) RETURNING id", [formula,version,ids.operator]);
      await denied("INSERT INTO public.production_queue(formula_id,formula_version_id,batch_size,batch_unit,requested_by) VALUES ($1,$2,10,'L',$3)", [formula,version,ids.admin], '42501');
      await denied('SELECT public.start_production_run($1,$2)', [queue,ids.admin], '42501');
      const badQueue = await scalar("INSERT INTO public.production_queue(formula_id,formula_version_id,batch_size,batch_unit,requested_by) VALUES ($1,$2,10,'L',$3) RETURNING id", [formula,otherVersion,ids.operator]);
      await denied('SELECT public.start_production_run($1)', [badQueue]);
      run = await scalar('SELECT public.start_production_run($1)', [queue]);
      assert.equal(await scalar('SELECT public.start_production_run($1)', [queue]), run);
      assert.equal(await scalar('SELECT count(*) FROM public.production_runs WHERE queue_item_id=$1',[queue]), 1);
      assert.equal(await scalar('SELECT started_by FROM public.production_runs WHERE id=$1',[run]), ids.operator);
      const rs = (await db.query('SELECT * FROM public.run_steps WHERE run_id=$1',[run])).rows[0];
      runStep = rs.id;
      assert.equal(rs.sort_order,0); // Sparse formula order is snapshotted into executable order.
      fields = (await db.query('SELECT * FROM public.run_step_inputs WHERE run_step_id=$1 ORDER BY sort_order',[runStep])).rows;
      validInputs = fields.map((field) => ({id:field.id,value:({checkbox:'true',number:'6.5',select:'Yes',text:'Recorded'})[field.field_type]}));
    });

    await t.test('snapshot and queue mutation bypasses are denied while pause/resume work', async () => {
      await as('operator');
      for (const table of ['production_runs','run_materials','run_steps','run_step_inputs']) {
        await denied(`DELETE FROM public.${table}`,[],'42501');
      }
      await denied("UPDATE public.production_runs SET status='completed' WHERE id=$1",[run],'42501');
      await denied("UPDATE public.run_steps SET status='completed' WHERE id=$1",[runStep],'42501');
      await denied("UPDATE public.run_step_inputs SET value='bypass' WHERE run_step_id=$1",[runStep],'42501');
      await denied('UPDATE public.run_materials SET actual_quantity=100 WHERE run_id=$1',[run],'42501');
      assert.equal((await db.query("UPDATE public.production_queue SET status='queued' WHERE id=$1 RETURNING id",[queue])).rows.length,0);
      await db.query("SELECT public.change_run_status($1,'paused')",[run]);
      await assert.rejects(complete(validInputs));
      await db.query("SELECT public.change_run_status($1,'in_progress')",[run]);
      await denied("SELECT public.change_run_status($1,'completed')",[run]);
      await as('admin');
      assert.equal((await db.query('DELETE FROM public.production_queue WHERE id=$1 RETURNING id',[queue])).rows.length,0);
      await denied("UPDATE public.production_runs SET formula_name='rewrite' WHERE id=$1",[run],'42501');
      await as('operator');
    });

    await t.test('typed step controls reject forged IDs, false confirmation, invalid numbers/choices and whitespace', async () => {
      const changed = (type,value) => validInputs.map((input,index) => fields[index].field_type===type?{...input,value}:input);
      for (const bad of [
        changed('checkbox','false'),changed('checkbox','yes'),changed('number','NaN'),
        changed('number','Infinity'),changed('number','no'),changed('number','9'),
        changed('number','3'),changed('select','Forged choice'),changed('text','   '),
        [...validInputs,validInputs[0]], [...validInputs,{id:ids.admin,value:'wrong step'}],
      ]) await assert.rejects(complete(bad));
      await assert.rejects(complete(validInputs,false));
      await assert.rejects(complete(validInputs,true,null));
      await assert.rejects(complete(validInputs,true,-1));
      await assert.rejects(complete(validInputs,true,'NaN'));
      await assert.rejects(complete(validInputs,true,10,ids.admin));
      await denied('SELECT public.complete_run_step($1,$2,null,$3::jsonb)',[run,runStep,'{}']);
      assert.equal(await scalar('SELECT count(*) FROM public.run_step_inputs WHERE run_step_id=$1 AND value IS NOT NULL',[runStep]),0);
      assert.equal(await scalar('SELECT status FROM public.production_runs WHERE id=$1',[run]),'in_progress');
    });

    await t.test('valid completion is atomic, attributed, repeatable, and immutable afterwards', async () => {
      await complete(validInputs);
      assert.equal(await scalar('SELECT completed_by FROM public.production_runs WHERE id=$1',[run]),ids.operator);
      assert.equal(await scalar('SELECT confirmed FROM public.run_steps WHERE id=$1',[runStep]),true);
      assert.equal(Number(await scalar('SELECT entered_quantity FROM public.run_steps WHERE id=$1',[runStep])),10);
      assert.equal(await scalar('SELECT status FROM public.production_queue WHERE id=$1',[queue]),'completed');
      await complete(validInputs);
      await assert.rejects(complete(validInputs.map((v)=>({...v,value:'changed'}))));
      await denied("SELECT public.change_run_status($1,'in_progress')",[run]);
      await denied("SELECT public.change_run_status($1,'cancelled')",[run]);
      await as('admin');
      assert.equal(await scalar("SELECT count(*) FROM public.security_events WHERE action='step_completed' AND target_id=$1",[runStep]),1);
      await denied("UPDATE public.security_events SET action='rewrite'",[],'42501');
    });

    await t.test('steps cannot be skipped, foreign-run field IDs fail, and cancellation preserves records', async () => {
      await db.exec('RESET ROLE');
      await db.query("INSERT INTO public.formula_steps(formula_version_id,step_number,title,requires_confirmation,requires_quantity_entry,sort_order) VALUES ($1,2,'Second step',false,false,20)",[version]);
      await as('operator');
      const nextQueue = await scalar("INSERT INTO public.production_queue(formula_id,formula_version_id,batch_size,batch_unit,requested_by) VALUES ($1,$2,10,'L',$3) RETURNING id",[formula,version,ids.operator]);
      const nextRun = await scalar('SELECT public.start_production_run($1)',[nextQueue]);
      const nextSteps = (await db.query('SELECT id FROM public.run_steps WHERE run_id=$1 ORDER BY sort_order',[nextRun])).rows;
      await denied('SELECT public.complete_run_step($1,$2)',[nextRun,nextSteps[1].id]);
      // These are real field IDs from a different, completed production run.
      await denied('SELECT public.complete_run_step($1,$2,null,$3::jsonb,true,10)',[nextRun,nextSteps[0].id,JSON.stringify(validInputs)]);
      const nextFields = (await db.query('SELECT id,field_type FROM public.run_step_inputs WHERE run_step_id=$1 ORDER BY sort_order',[nextSteps[0].id])).rows;
      const nextInputs = nextFields.map((field)=>({id:field.id,value:({checkbox:'true',number:'6.5',select:'Yes',text:'Recorded'})[field.field_type]}));
      await db.query('SELECT public.complete_run_step($1,$2,null,$3::jsonb,true,10)',[nextRun,nextSteps[0].id,JSON.stringify(nextInputs)]);
      assert.equal(await scalar('SELECT current_step_index FROM public.production_runs WHERE id=$1',[nextRun]),1);
      await db.query('SELECT public.complete_run_step($1,$2,null,$3::jsonb,true,10)',[nextRun,nextSteps[0].id,JSON.stringify(nextInputs)]);
      assert.equal(await scalar('SELECT current_step_index FROM public.production_runs WHERE id=$1',[nextRun]),1);
      await db.query("SELECT public.change_run_status($1,'cancelled')",[nextRun]);
      await denied('SELECT public.complete_run_step($1,$2)',[nextRun,nextSteps[1].id]);
      await denied("SELECT public.change_run_status($1,'in_progress')",[nextRun]);
      assert.equal(await scalar('SELECT count(*) FROM public.run_steps WHERE run_id=$1',[nextRun]),2);
      assert.equal(await scalar('SELECT status FROM public.production_queue WHERE id=$1',[nextQueue]),'cancelled');
    });

    await t.test('new workflow functions have pinned paths and no anonymous execution', async () => {
      await db.exec('RESET ROLE');
      const rows = (await db.query(`SELECT proname,proconfig,
        has_function_privilege('anon',p.oid,'execute') AS anon,
        has_function_privilege('authenticated',p.oid,'execute') AS staff
        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND proname IN
        ('get_user_role','start_production_run','complete_run_step','calculate_batch','change_run_status','admin_update_profile')`)).rows;
      assert.equal(rows.length,6);
      for (const row of rows) {
        assert.equal(row.anon,false,row.proname);
        assert.equal(row.staff,true,row.proname);
        assert.ok(row.proconfig.some((setting)=>setting.startsWith('search_path=')),row.proname);
      }
    });
  } finally {
    await db.close();
  }
});
