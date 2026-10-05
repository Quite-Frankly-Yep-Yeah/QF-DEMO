# Installing quite frankly an example LMS

This guide covers a development install with Docker and the extra steps a
production install needs. It is written for this fork; the upstream Canvas
guides ([Quick Start](https://github.com/instructure/canvas-lms/wiki/Quick-Start),
[Production Start](https://github.com/instructure/canvas-lms/wiki/Production-Start))
still apply where this guide sends you to them.

After installing, sign in as the administrator you created and open
**`/install_status`**. That page is a checklist of everything below. It ticks
the steps it can detect by itself, and you can tick the rest by hand.

## 1. Development install with Docker

You need Docker with Compose v2 (see [doc/docker/getting_docker.md](../doc/docker/getting_docker.md)).

```bash
git clone https://github.com/Quite-Frankly-Yep-Yeah/QF-DEMO.git
cd QF-DEMO
./script/docker_dev_setup.sh     # builds images, assets and the database
docker compose up                # http://localhost:3000
```

The setup script runs `rake db:initial_setup`, which asks for the first
administrator's email and password and the school's name. To run it again
later:

```bash
docker compose run --rm web bundle exec rake db:initial_setup
```

To rebuild from nothing (this deletes the database volume):

```bash
docker compose down -v
docker compose up --build
docker compose run --rm web bash -c "bundle install && yarn install && rake db:create db:migrate"
```

For frontend work, run `yarn build:watch` inside the web container. More
Docker tips are in [doc/docker/developing_with_docker.md](../doc/docker/developing_with_docker.md).

## 2. Production install

Follow the upstream [Production Start](https://github.com/instructure/canvas-lms/wiki/Production-Start)
guide for the server, Postgres, Redis, Apache/Passenger or Puma and asset
compilation. Then come back for the configuration below. The fork needs
nothing extra at the server level: its features are Rails code, React bundles
and database migrations that ship with the app.

## 3. Configuration

Each section below is a step on `/install_status`.

### Domain

Copy `config/domain.yml.example` to `config/domain.yml` and set `domain` to the
address people type to reach the site (for example `lms.school.edu`). Links in
email, LTI launches and file downloads use it. Restart the app after changing it.

### Mail

Copy `config/outgoing_mail.yml.example` to `config/outgoing_mail.yml` and fill
in your SMTP server and an `outgoing_address`. Without it the site can't send
notifications, password resets or the self-paced alert emails. In development,
the `mailcatcher` override in `docker-compose/` catches mail locally.

### Background jobs

Notifications, course imports, reports and the nightly self-paced jobs
(pacing re-spread, alerts, attendance) run as background jobs.

- Docker: the `jobs` service in `docker-compose.yml` runs them.
- Production: run `script/delayed_job run` under your process manager
  (systemd, supervisord). See the upstream Production Start guide.

The step is ticked while no job has waited more than 15 minutes. You can also
look at `/jobs` as a site admin.

### Self-paced platform

The self-paced features are behind feature flags so each school can turn them on
in order. Go to **Admin > (your school) > Settings > Feature Options** and turn on:

1. **Self-Paced Platform** (the umbrella; nothing else works without it)
2. **Self-Paced: Activity Tracking**
3. **Self-Paced: Teacher Dashboard**
4. **Self-Paced: Student Home**
5. Then the ones you want, for the school or per course: **Course Player**,
   **Pacing**, **Interventions**, **Course Page**, **Quiz Reader**, **Alerts**,
   **Reports**, **Observer View**, **Test Out**, **Admin Course Catalog**

The flags start hidden, so only a site admin sees them until they are rolled
out. What each one does is in [docs/fork-plan.md](fork-plan.md).

### Courses and people

Create courses and users under **Admin > (your school)**, or import them with SIS
CSV files (**Admin > SIS Import**). The step is ticked once anyone is enrolled
in a course.

### Anthropic API key (optional)

Only the AI features, such as IEP scanning, need it. Add a key for the whole
site or one school at **Admin > (your school) > AI settings**
(`/accounts/:id/ai_settings`). A server-wide key can also go in
`config/anthropic.yml`.

### Demo data

To try the site with something in it, load a sample course:

```bash
docker compose run --rm web bundle exec rake qf:demo_data
# or, outside Docker
bundle exec rake qf:demo_data DEMO_PASSWORD=choose-a-password
```

This creates "Demo: Algebra I" with two units, one teacher
(`teacher@demo.example.com`) and three students (`student1@` to
`student3@demo.example.com`). Without `DEMO_PASSWORD` it prints a random
password for the new logins. Running it again reuses what is there. Use
`ACCOUNT_ID=` to put it in a school other than the default account.

The task refuses to run in production unless `ALLOW_DEMO_DATA=1` is set,
because it creates logins with a known password.
