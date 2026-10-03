# frozen_string_literal: true

# Demo data for the self-paced, teacher dashboard and parent features:
#
#   docker compose run --rm web bundle exec rake db:demo_data
#
# Makes ~70 students, 20 courses (every kind of lesson, activity and quiz
# question), staff, parents and some simulated progress. Safe to run again: it
# reuses what exists and only builds content for courses it creates.
#
# Every demo login is demo.<something>@example.com with the password below.
module DemoData
  PASSWORD = "demo1234"
  STUDENT_COUNT = 70
  PARENT_COUNT = 30
  VIDEO_URL = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
  AUDIO_URL = "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3"

  FIRST_NAMES = %w[Aaliyah Aiden Amara Andre Beatriz Caleb Camila Dante Elena Emeka Fatima Gabriel Hana Isaac Imani
                   Jamal Keiko Liam Lucia Marcus Maya Nia Noah Omar Priya Rafael Sofia Tariq Talia Uma Violet Wyatt
                   Ximena Yusuf Zara].freeze
  LAST_NAMES = %w[Adeyemi Alvarez Bennett Castillo Chen Dang Ellison Flores Gupta Haddad Ito Johnson Kowalski Lindqvist
                  Morales Nakamura Okafor Patel Ramirez Singh].freeze
  TEACHERS = ["Ms. Rivera", "Mr. Okonkwo", "Dr. Lindgren", "Ms. Park", "Mr. Delgado", "Ms. Abara"].freeze
  MENTORS = ["Coach Hartley", "Ms. Whitfield"].freeze
  EDITOR = "Mr. Castellano"
  WRONG_TERMS = %w[Quasar Syntax Tundra Ledger Allegro Mosaic Vertex Parable].freeze

  # name, code, [3 units], [4 [term, definition]], [2 [statement, true?]], [numeric question, answer]
  COURSES = [
    ["Algebra 1", "ALG1", ["Linear Equations", "Functions and Graphs", "Systems of Equations"],
     [["Variable", "a symbol that stands for an unknown number"], ["Coefficient", "the number multiplied by a variable"], ["Slope", "the steepness of a line, rise over run"], ["Intercept", "where a line crosses an axis"]],
     [["Every linear equation graphs as a straight line.", true], ["The slope of a horizontal line is 1.", false]], ["Solve 3x + 5 = 20. What is x?", 5]],
    ["Geometry", "GEOM", ["Angles and Lines", "Triangles", "Circles"],
     [["Vertex", "the point where two rays of an angle meet"], ["Congruent", "having exactly the same shape and size"], ["Radius", "the distance from a circle's center to its edge"], ["Perpendicular", "meeting at a right angle"]],
     [["The angles of a triangle add up to 180 degrees.", true], ["A circle's diameter is half its radius.", false]], ["Two angles of a triangle are 50 and 60 degrees. What is the third angle?", 70]],
    ["Algebra 2", "ALG2", ["Quadratics", "Exponents and Logarithms", "Polynomials"],
     [["Parabola", "the U-shaped graph of a quadratic function"], ["Root", "a value of x where a function equals zero"], ["Logarithm", "the exponent a base is raised to in order to get a number"], ["Discriminant", "the part of the quadratic formula under the square root"]],
     [["A quadratic can have at most two real roots.", true], ["log base 10 of 1000 equals 2.", false]], ["What is log base 2 of 32?", 5]],
    ["Statistics", "STAT", ["Describing Data", "Probability", "Sampling and Inference"],
     [["Mean", "the sum of values divided by how many there are"], ["Median", "the middle value when data is ordered"], ["Outlier", "a value far from the rest of the data"], ["Sample", "a part of a population chosen for study"]],
     [["The median is affected by outliers more than the mean is.", false], ["Probabilities range from 0 to 1.", true]], ["Find the mean of 4, 8, 6, 10 and 12.", 8]],
    ["Biology", "BIO", ["Cells", "Genetics", "Ecosystems"],
     [["Organelle", "a small structure with a job inside a cell"], ["Allele", "one version of a gene"], ["Producer", "an organism that makes its own food"], ["Habitat", "the place where an organism lives"]],
     [["Mitochondria release energy for the cell.", true], ["All mutations are harmful.", false]], ["A bacterium splits every 20 minutes. How many bacteria after 1 hour, starting from 1?", 8]],
    ["Chemistry", "CHEM", ["Atoms and the Periodic Table", "Bonding", "Reactions"],
     [["Proton", "a positively charged particle in the nucleus"], ["Isotope", "an atom with a different number of neutrons"], ["Covalent bond", "a bond formed by sharing electrons"], ["Catalyst", "a substance that speeds up a reaction without being used up"]],
     [["The periodic table is arranged by atomic number.", true], ["Ionic bonds share electrons equally.", false]], ["How many neutrons are in carbon-14 (6 protons)?", 8]],
    ["Physics", "PHYS", ["Motion", "Forces", "Energy"],
     [["Velocity", "speed in a given direction"], ["Acceleration", "the rate at which velocity changes"], ["Inertia", "an object's resistance to changes in its motion"], ["Joule", "the unit of energy"]],
     [["Heavier objects fall faster in a vacuum.", false], ["Force equals mass times acceleration.", true]], ["A 5 kg cart is pushed with 20 N. What is its acceleration in m/s^2?", 4]],
    ["Earth Science", "EARTH", ["Plate Tectonics", "Weather and Climate", "Rocks and Minerals"],
     [["Lithosphere", "Earth's rigid outer layer"], ["Convection", "heat moving through the flow of a fluid"], ["Sediment", "small pieces of rock moved by wind or water"], ["Fault", "a crack in the crust where blocks move"]],
     [["Igneous rock forms from cooled magma.", true], ["Weather and climate mean the same thing.", false]], ["A plate moves 3 cm a year. How many cm in 25 years?", 75]],
    ["English 9", "ENG9", ["Reading Fiction", "Argument Writing", "Poetry"],
     [["Theme", "the central message of a story"], ["Protagonist", "the main character"], ["Thesis", "the main claim of an essay"], ["Metaphor", "a comparison that says one thing is another"]],
     [["A thesis belongs in the conclusion only.", false], ["Setting includes both time and place.", true]], ["A paragraph needs 5 sentences. You have written 3. How many more?", 2]],
    ["English 10", "ENG10", ["Rhetoric", "Research Writing", "Drama"],
     [["Ethos", "an appeal based on the speaker's credibility"], ["Pathos", "an appeal to emotion"], ["Citation", "a note crediting where information came from"], ["Soliloquy", "a speech a character gives alone on stage"]],
     [["A primary source is a first-hand account.", true], ["Plagiarism is fine if you change a few words.", false]], ["An essay needs 4 sources and you have 1. How many more?", 3]],
    ["Creative Writing", "CWRIT", ["Voice and Imagery", "Story Structure", "Revision"],
     [["Imagery", "language that appeals to the senses"], ["Conflict", "the struggle that drives a plot"], ["Climax", "the turning point of a story"], ["Revision", "re-seeing a draft to improve it"]],
     [["Show, don't tell means describing through detail.", true], ["A first draft should be perfect.", false]], ["A story has 6 scenes of about 250 words. About how many words?", 1500]],
    ["Public Speaking", "SPEAK", ["Organizing a Speech", "Delivery", "Persuasion"],
     [["Hook", "the opening line meant to catch attention"], ["Pacing", "how fast or slow you speak"], ["Audience", "the people you are speaking to"], ["Rebuttal", "a response to an opposing point"]],
     [["Eye contact helps build trust.", true], ["You should read your slides word for word.", false]], ["A speech is 6 minutes. You speak 130 words a minute. How many words?", 780]],
    ["World History", "WHIST", ["Early Civilizations", "Trade and Empires", "Revolutions"],
     [["Civilization", "a society with cities, government and writing"], ["Empire", "many lands ruled by one government"], ["Silk Road", "the trade routes joining China and the Mediterranean"], ["Revolution", "a sudden, major change in government or society"]],
     [["The Nile supported early Egyptian farming.", true], ["The printing press was invented in ancient Rome.", false]], ["An empire lasted from 1200 to 1500. How many years?", 300]],
    ["US History", "USHIST", ["Colonial Era", "Civil War", "The 20th Century"],
     [["Colony", "land settled and governed by a distant country"], ["Abolition", "the movement to end slavery"], ["Amendment", "a change added to the Constitution"], ["Suffrage", "the right to vote"]],
     [["The Declaration of Independence was signed in 1776.", true], ["The Civil War ended in 1812.", false]], ["The Civil War began in 1861 and ended in 1865. How many years did it last?", 4]],
    ["Government", "GOV", ["Foundations", "Branches of Government", "Citizenship"],
     [["Constitution", "the document that sets out a nation's basic laws"], ["Veto", "a leader's power to reject a bill"], ["Federalism", "power shared between national and state governments"], ["Jury", "citizens who decide the facts of a trial"]],
     [["Congress writes laws.", true], ["The Supreme Court makes the budget.", false]], ["The Senate has 100 members. How many make a simple majority?", 51]],
    ["Economics", "ECON", ["Supply and Demand", "Markets", "Money and Banking"],
     [["Scarcity", "not having enough resources to meet every want"], ["Inflation", "a general rise in prices"], ["Opportunity cost", "the value of the next best choice you give up"], ["Interest", "the cost of borrowing money"]],
     [["When demand rises and supply stays the same, prices tend to rise.", true], ["A monopoly has many competitors.", false]], ["You earn 5 percent interest on $200 for one year. How many dollars of interest?", 10]],
    ["Computer Science Principles", "CSP", ["Algorithms", "Data and the Internet", "Programming"],
     [["Algorithm", "a step-by-step procedure to solve a problem"], ["Bit", "the smallest unit of data, a 0 or a 1"], ["Loop", "code that repeats"], ["Bug", "a mistake in a program"]],
     [["Binary uses only the digits 0 and 1.", true], ["A variable's value can never change.", false]], ["What is the binary number 1011 in decimal?", 11]],
    ["Spanish 1", "SPAN1", ["Greetings and Introductions", "Family and Home", "Food and Daily Life"],
     [["Hola", "hello"], ["Familia", "family"], ["Gracias", "thank you"], ["Casa", "house"]],
     [["Buenos dias means good morning.", true], ["Adios means hello.", false]], ["Count the vowels in the word 'familia'.", 4]],
    ["Health and Wellness", "HEALTH", ["Nutrition", "Mental Health", "Safety and Prevention"],
     [["Nutrient", "a substance the body needs to live and grow"], ["Stress", "the body's response to a demand or challenge"], ["Hydration", "having enough water in the body"], ["Boundary", "a limit that protects your well-being"]],
     [["Sleep helps the brain and body recover.", true], ["Skipping breakfast always improves focus.", false]], ["You drink 250 mL of water 8 times a day. How many mL is that?", 2000]],
    ["Personal Finance", "FIN", ["Budgeting", "Saving and Credit", "Taxes and Work"],
     [["Budget", "a plan for spending and saving money"], ["Credit score", "a number that shows how reliably you repay debt"], ["Net pay", "what you take home after taxes"], ["Emergency fund", "savings kept for unexpected costs"]],
     [["Paying only the minimum on a credit card costs more over time.", true], ["Gross pay is what you take home.", false]], ["You earn $1,000 and save 15 percent. How many dollars do you save?", 150]]
  ].freeze

  class Builder
    def initialize
      @root = Account.default
      @id_counter = 1000
      @log = []
    end

    def run
      ensure_flags
      @teachers = TEACHERS.each_with_index.map { |name, i| user_for(name, "demo.teacher#{i + 1}@example.com") }
      @mentors = MENTORS.each_with_index.map { |name, i| user_for(name, "demo.mentor#{i + 1}@example.com") }
      @editor = user_for(EDITOR, "demo.editor@example.com")
      @students = student_names.each_with_index.map { |name, i| user_for(name, format("demo.student%02d@example.com", i + 1), "#{name.split.first}") }
      assign_staff_roles
      @courses = COURSES.each_with_index.map { |data, i| build_course(data, @teachers[i % @teachers.length]) }
      enroll_students
      build_parents
      simulate_progress
      refresh_dashboards
      summary
    end

    private

    def say(message)
      puts message
      $stdout.flush
    end

    def ensure_flags
      return if @root.feature_enabled?(:self_paced)

      say "The self_paced flag is off for #{@root.name}. Run db:enable_fork_features first (db:initial_setup does)."
      raise "self-paced features are not enabled"
    end

    # --- people ----------------------------------------------------------

    def student_names
      names = []
      i = 0
      while names.length < STUDENT_COUNT
        name = "#{FIRST_NAMES[i % FIRST_NAMES.length]} #{LAST_NAMES[(i * 7 + i / FIRST_NAMES.length) % LAST_NAMES.length]}"
        names << name unless names.include?(name)
        i += 1
      end
      names
    end

    def user_for(name, email, short_name = nil)
      pseudonym = @root.pseudonyms.active.by_unique_id(email).first
      return pseudonym.user if pseudonym

      user = User.create!(name:, short_name: short_name || name)
      user.register!
      user.pseudonyms.create!(unique_id: email, password: PASSWORD, password_confirmation: PASSWORD, account: @root)
      user.communication_channels.create!(path: email) { |cc| cc.workflow_state = "active" }
      user
    end

    def assign_staff_roles
      mentor_role = SelfPaced::MentorRole.ensure!(@root)
      editor_role = SelfPaced::CourseEditorRole.ensure!(@root)
      @mentors.each { |user| @root.account_users.where(user:, role: mentor_role).first_or_create! }
      @root.account_users.where(user: @editor, role: editor_role).first_or_create!
      say "Staff: #{@teachers.length} teachers, #{@mentors.length} mentors, 1 course editor"
    end

    def build_parents
      parents = (1..PARENT_COUNT).map do |n|
        user_for("#{LAST_NAMES[(n * 3) % LAST_NAMES.length]} Family #{n}", format("demo.parent%02d@example.com", n))
      end
      # parents 1-24 follow one or two students; the rest are new parents waiting on the school
      parents.first(24).each_with_index do |parent, i|
        [@students[i * 2], (@students[i * 2 + 1] if i < 8)].compact.each do |student|
          UserObservationLink.create_or_restore(observer: parent, student:, root_account: @root)
        end
      end
      parents.last(6).each_with_index do |parent, i|
        SelfPaced::SchoolParentSignup.mark_as_parent!(parent)
        next unless i < 3

        SelfPaced::LinkRequest.ask!(observer: parent, student: @students[50 + i], root_account: @root, note: "I'm their parent.")
      rescue SelfPaced::LinkRequest::Refused
        nil
      end
      say "Parents: #{parents.length} (24 linked, 3 with pending link requests, 3 awaiting a request)"
    end

    # --- courses ---------------------------------------------------------

    def build_course(data, teacher)
      name, code, units, terms, facts, numeric = data
      sis_id = "demo-#{code.downcase}"
      existing = @root.all_courses.find_by(sis_source_id: sis_id)
      if existing
        # Reuse the course. It still needs simulated progress if nobody has submitted anything yet.
        needs_progress = Quizzes::QuizSubmission.where(quiz_id: existing.quizzes.select(:id)).count < 30
        say "Course exists: #{name}#{" (will simulate progress)" if needs_progress}"
        return { course: existing, fresh: needs_progress, tags: existing_tags(existing) }
      end

      course = Course.create!(name:, course_code: code, account: @root, sis_source_id: sis_id,
                              start_at: 6.weeks.ago, conclude_at: 14.weeks.from_now)
      course.offer!
      course.enroll_teacher(teacher, enrollment_state: "active")
      tags = []
      skills = units.map { |unit| make_skill(course, unit) }
      units.each_with_index do |unit, index|
        tags.concat(build_unit(course, teacher, name, unit, index, terms, facts, numeric, skills[index]))
      end
      configure(course, tags)
      say "Built course: #{name} (#{tags.length} items)"
      { course:, fresh: true, tags: }
    end

    def existing_tags(course)
      course.context_modules.not_deleted.order(:position, :id).flat_map do |mod|
        mod.content_tags.not_deleted.order(:position, :id).map do |tag|
          [tag, SelfPaced::ItemSetting.find_by(content_tag: tag)&.role || "none", {}]
        end
      end
    end

    def make_skill(course, title)
      outcome = LearningOutcome.create!(context: course, short_description: "I can: #{title.downcase}",
                                        description: "Demonstrates understanding of #{title}.")
      course.root_outcome_group.add_outcome(outcome)
      outcome
    end

    # Returns [[content_tag, role, extra_settings], ...] in module order.
    def build_unit(course, teacher, course_name, unit, index, terms, facts, numeric, skill)
      mod = course.context_modules.create!(name: "Unit #{index + 1}: #{unit}")
      items = []
      add = lambda do |role, tag, **extra|
        tag.publish if tag.respond_to?(:publish) && !tag.published?
        items << [tag, role, extra]
      end

      add.call("none", mod.add_item(type: "context_module_sub_header", title: "Unit #{index + 1}: #{unit}"))
      if index.positive?
        pretest = quiz(course, "#{unit}: Pretest", auto_questions(terms, facts, numeric, unit), points: 10)
        add.call("pretest", mod.add_item(type: "quiz", id: pretest.id), mastery_threshold: 80, max_attempts: 1)
      end
      page = wiki_page(course, "#{unit}: Reading", reading_html(course_name, unit, terms))
      add.call("instruction", mod.add_item(type: "wiki_page", id: page.id), skill_id: skill.id)
      video = wiki_page(course, "#{unit}: Video lesson", video_html(unit))
      add.call("instruction", mod.add_item(type: "wiki_page", id: video.id), watch_fraction: 0.8, skill_id: skill.id)
      audio = wiki_page(course, "#{unit}: Audio walkthrough", audio_html(unit, terms))
      add.call("instruction", mod.add_item(type: "wiki_page", id: audio.id), estimated_minutes: 8)
      worked = wiki_page(course, "#{unit}: Worked examples", worked_html(unit, terms, numeric))
      add.call("instruction", mod.add_item(type: "wiki_page", id: worked.id), skill_id: skill.id)
      add.call("none", mod.add_item(type: "external_url", title: "#{unit}: Further reading (Wikipedia)",
                                    url: "https://en.wikipedia.org/wiki/#{unit.split(" and ").first.tr(" ", "_")}"))
      add.call("none", mod.add_item(type: "attachment", id: study_guide(course, unit, terms).id))
      practice_quiz = quiz(course, "#{unit}: Practice", auto_questions(terms, facts, numeric, unit).first(4), points: 4, type: "practice_quiz")
      add.call("practice", mod.add_item(type: "quiz", id: practice_quiz.id))
      add.call("practice", mod.add_item(type: "assignment", id: written_assignment(course, unit, terms).id), estimated_minutes: 20)
      add.call("practice", mod.add_item(type: "discussion_topic", id: discussion(course, teacher, unit, terms).id))
      check = quiz(course, "#{unit}: Mastery check", auto_questions(terms, facts, numeric, unit), points: 10)
      add.call("check", mod.add_item(type: "quiz", id: check.id), mastery_threshold: 70, max_attempts: 3)

      if index == 2
        every = quiz(course, "Everything quiz: every question type", every_type_questions(course_name, terms, facts, numeric, unit),
                     points: nil, type: "practice_quiz")
        add.call("practice", mod.add_item(type: "quiz", id: every.id))
        upload = course.assignments.create!(title: "Final project: #{course_name}", points_possible: 40, submission_types: "online_upload,online_text_entry",
                                            description: "<p>Share a project that shows what you learned in #{course_name}. Upload a file or write a response.</p>",
                                            workflow_state: "published")
        add.call("practice", mod.add_item(type: "assignment", id: upload.id), estimated_minutes: 60)
      end
      mod.publish
      items.each { |tag, _, _| tag.publish unless tag.published? }
      items
    end

    def configure(course, tags)
      course.update!(self_paced_mastery_threshold: 70) if course.respond_to?(:self_paced_mastery_threshold=)
      settings = tags.map do |tag, role, extra|
        { id: tag.id, role:, **extra }
      end
      SelfPaced::CourseSetup.new(course).apply!(mastery_threshold: 70, items: settings)
    end

    # --- content ---------------------------------------------------------

    def wiki_page(course, title, body)
      course.wiki_pages.create!(title:, body:, workflow_state: "active")
    end

    def reading_html(course_name, unit, terms)
      rows = terms.map { |term, definition| "<tr><td><strong>#{term}</strong></td><td>#{definition}</td></tr>" }.join
      <<~HTML
        <h2>#{unit}</h2>
        <p>Welcome to this unit of <em>#{course_name}</em>. Read through the key ideas, then move on to the video and the practice.</p>
        <h3>Key terms</h3>
        <table><thead><tr><th scope="col">Term</th><th scope="col">Meaning</th></tr></thead><tbody>#{rows}</tbody></table>
        <h3>What to remember</h3>
        <ol><li>Learn the four key terms above.</li><li>Try to say each one in your own words.</li><li>Look for them as you read and watch.</li></ol>
        <blockquote><p>Mastery means you can explain it, not just recognize it.</p></blockquote>
      HTML
    end

    def video_html(unit)
      <<~HTML
        <h2>#{unit}: watch the lesson</h2>
        <p>Watch most of the video to move on. Skipping ahead doesn't count.</p>
        <video controls width="640" preload="metadata" src="#{VIDEO_URL}" title="#{unit} lesson video"></video>
      HTML
    end

    def audio_html(unit, terms)
      <<~HTML
        <h2>#{unit}: listen</h2>
        <p>An audio walkthrough of the key terms: #{terms.map(&:first).to_sentence}.</p>
        <audio controls src="#{AUDIO_URL}" title="#{unit} audio"></audio>
      HTML
    end

    def worked_html(unit, terms, numeric)
      <<~HTML
        <h2>#{unit}: worked examples</h2>
        <details open><summary>Example 1</summary><p>#{numeric[0]}</p><p>Answer: <strong>#{numeric[1]}</strong></p></details>
        <details><summary>Example 2</summary><p>Use the term <strong>#{terms[0][0]}</strong> in a sentence about #{unit.downcase}.</p></details>
        <p><em>Tip:</em> work the example on paper before opening the answer.</p>
      HTML
    end

    def study_guide(course, unit, terms)
      text = "Study guide: #{unit}\n\n#{terms.map { |term, definition| "#{term}: #{definition}" }.join("\n")}\n"
      path = Rails.root.join("tmp/demo-study-guide-#{SecureRandom.hex(4)}.txt")
      File.write(path, text)
      upload = ActionDispatch::Http::UploadedFile.new(tempfile: File.open(path), filename: "#{unit.parameterize}-study-guide.txt", type: "text/plain")
      attachment = course.attachments.create!(uploaded_data: upload, display_name: "#{unit} study guide")
      attachment.update!(locked: false)
      attachment
    ensure
      FileUtils.rm_f(path) if path
    end

    def written_assignment(course, unit, terms)
      course.assignments.create!(title: "#{unit}: Explain it", points_possible: 10, submission_types: "online_text_entry",
                                 description: "<p>In a short paragraph, explain <strong>#{terms[0][0]}</strong> and <strong>#{terms[1][0]}</strong> in your own words.</p>",
                                 workflow_state: "published")
    end

    def discussion(course, teacher, unit, terms)
      course.discussion_topics.create!(title: "#{unit}: Discussion", user: teacher, workflow_state: "active",
                                       message: "<p>Where might you see <strong>#{terms[2][0]}</strong> outside of school? Share an example and reply to a classmate.</p>")
    end

    # --- quizzes ---------------------------------------------------------

    def next_id
      @id_counter += 1
    end

    def quiz(course, title, questions, points:, type: "assignment")
      quiz = course.quizzes.create!(title:, quiz_type: type, allowed_attempts: (type == "assignment" ? 3 : -1),
                                    description: "<p>#{title}</p>", scoring_policy: "keep_latest")
      questions.each_with_index do |data, position|
        data = data.merge(position: position + 1)
        quiz.quiz_questions.create!(question_data: data)
      end
      quiz.reload
      quiz.generate_quiz_data
      quiz.published_at = Time.zone.now
      quiz.workflow_state = "available"
      quiz.save!
      quiz
    end

    def base(type, text, points: 1)
      { question_type: type, question_name: text.truncate(40), question_text: "<p>#{text}</p>", points_possible: points,
        correct_comments: "", incorrect_comments: "", neutral_comments: "" }
    end

    def answer(text, weight, **more)
      { id: next_id, text:, weight:, comments: "" }.merge(more)
    end

    # Questions the system can grade by itself, so mastery gating works.
    def auto_questions(terms, facts, numeric, unit)
      distractors = WRONG_TERMS.first(3)
      term, definition = terms[0]
      [
        base("multiple_choice_question", "Which term means: #{definition}?")
          .merge(answers: ([answer(term, 100)] + distractors.map { |wrong| answer(wrong, 0) }).shuffle),
        base("true_false_question", facts[0][0])
          .merge(answers: [answer("True", facts[0][1] ? 100 : 0), answer("False", facts[0][1] ? 0 : 100)]),
        base("multiple_answers_question", "Select every term that belongs to #{unit}.", points: 2)
          .merge(answers: terms.first(2).map { |t, _| answer(t, 100) } + WRONG_TERMS.last(2).map { |t| answer(t, 0) }),
        base("numerical_question", numeric[0], points: 2)
          .merge(answers: [answer("", 100, numerical_answer_type: "exact_answer", exact: numeric[1], margin: 0)]),
        base("matching_question", "Match each term to its meaning.", points: 2).merge(matching_data(terms)),
        base("true_false_question", facts[1][0])
          .merge(answers: [answer("True", facts[1][1] ? 100 : 0), answer("False", facts[1][1] ? 0 : 100)]),
        base("fill_in_multiple_blanks_question", "A [one] is #{terms[1][1]}, and a [two] is #{terms[2][1]}.", points: 2)
          .merge(answers: [answer(terms[1][0].downcase, 100, blank_id: "one"), answer(terms[2][0].downcase, 100, blank_id: "two")])
      ]
    end

    def matching_data(terms)
      answers = terms.map { |t, d| answer(t, 0, left: t, right: d, match_id: next_id) }
      { answers:, matches: answers.map { |a| { match_id: a[:match_id], text: a[:right] } } }
    end

    def every_type_questions(course_name, terms, facts, numeric, unit)
      a_term, a_definition = terms[3]
      first, second = terms[0], terms[1]
      auto_questions(terms, facts, numeric, unit) + [
        base("short_answer_question", "Name the term that means: #{a_definition}.")
          .merge(answers: [answer(a_term.downcase, 100), answer(a_term, 100)]),
        base("multiple_dropdowns_question", "[first] means #{first[1]}. [second] means #{second[1]}.", points: 2)
          .merge(answers: [answer(first[0], 100, blank_id: "first"), answer(second[0], 0, blank_id: "first"), answer(WRONG_TERMS[0], 0, blank_id: "first"),
                           answer(second[0], 100, blank_id: "second"), answer(first[0], 0, blank_id: "second"), answer(WRONG_TERMS[1], 0, blank_id: "second")]),
        base("calculated_question", "What is [a] times [b]?", points: 2).merge(calculated_data),
        base("essay_question", "In your own words, explain #{first[0]} and give an example from #{course_name}.", points: 5),
        base("file_upload_question", "Upload a photo or file of your notes on #{unit}.", points: 3),
        base("text_only_question", "Next you will answer short written questions. Take your time.", points: 0)
      ]
    end

    def calculated_data
      sets = [[3, 4], [6, 7], [8, 9]]
      { formulas: [{ formula: "a * b" }], answer_tolerance: 0, formula_decimal_places: 0,
        variables: [{ name: "a", min: 2, max: 9, scale: 0 }, { name: "b", min: 2, max: 9, scale: 0 }],
        answers: sets.map { |a, b| { id: next_id, weight: 100, answer: a * b, variables: [{ name: "a", value: a }, { name: "b", value: b }] } } }
    end

    # --- enrollment and progress ----------------------------------------

    def enroll_students
      @enrollments = []
      @students.each_with_index do |student, i|
        [0, 3, 7, 11, 15].each_with_index do |offset, k|
          entry = @courses[(i + offset) % @courses.length]
          enrollment = entry[:course].enroll_student(student, enrollment_state: "active")
          enrollment.update_columns(created_at: (2 + ((i + k) % 4)).weeks.ago) if entry[:fresh]
          @enrollments << [student, entry, i, k]
        end
      end
      say "Enrolled #{@students.length} students in #{@enrollments.length} course spots"
    end

    def simulate_progress
      @enrollments.each do |student, entry, i, k|
        next unless entry[:fresh]

        rng = Random.new((i * 31) + (k * 7))
        roll = rng.rand
        # not started, early, mid, late, finished
        fraction = if roll < 0.12 then 0.0
                   elsif roll < 0.35 then rng.rand(0.1..0.3)
                   elsif roll < 0.7 then rng.rand(0.3..0.6)
                   elsif roll < 0.9 then rng.rand(0.6..0.9)
                   else 1.0
                   end
        stuck = rng.rand < 0.15
        work_through(student, entry[:course], entry[:tags], fraction, stuck, rng)
      end
    end

    def work_through(student, course, tags, fraction, stuck, rng)
      stop_at = (tags.length * fraction).floor
      tags.each_with_index do |(tag, role, _extra), index|
        break if index >= stop_at

        content = tag.content
        case content
        when Quizzes::Quiz
          next if role == "none"

          score = if role == "check" && stuck && index >= stop_at - 1 then 0.4
                  else rng.rand(0.75..1.0)
                  end
          take_quiz(student, content, score, rng)
        when Assignment
          content.submit_homework(student, submission_type: "online_text_entry", body: "<p>#{student.short_name}'s answer for #{content.title}.</p>")
        when WikiPage
          if (setting = SelfPaced::ItemSetting.find_by(content_tag: tag))&.watch_fraction
            at = Time.zone.now
            SelfPaced::VideoProgressRecorder.record(user: student, course:, tag:, fraction: 0.9, duration: 120, at: at - 3.minutes)
            SelfPaced::VideoProgressRecorder.record(user: student, course:, tag:, fraction: 0.95, duration: 120, at:)
          else
            tag.context_module_action(student, :read)
          end
        else
          tag.context_module_action(student, :read)
        end
      end
    rescue => e
      say "  progress skipped for #{student.name} in #{course.name}: #{e.class}: #{e.message.truncate(120)}"
    end

    def take_quiz(student, quiz, score, rng)
      submission = quiz.generate_submission(student)
      data = {}
      quiz.stored_questions.each do |question|
        next unless rng.rand <= score

        data.merge!(correct_answers(question.with_indifferent_access))
      end
      submission.submission_data = data
      submission.workflow_state = "complete"
      Quizzes::SubmissionGrader.new(submission).grade_submission
    end

    def correct_answers(q)
      id = q[:id]
      case q[:question_type]
      when "multiple_choice_question", "true_false_question"
        { "question_#{id}" => q[:answers].find { |a| a[:weight] == 100 }[:id].to_s }
      when "multiple_answers_question"
        q[:answers].select { |a| a[:weight] == 100 }.to_h { |a| ["question_#{id}_answer_#{a[:id]}", "1"] }
      when "numerical_question"
        { "question_#{id}" => q[:answers].first[:exact].to_s }
      when "short_answer_question"
        { "question_#{id}" => q[:answers].first[:text] }
      when "matching_question"
        q[:answers].to_h { |a| ["question_#{id}_answer_#{a[:id]}", a[:match_id].to_s] }
      when "fill_in_multiple_blanks_question"
        q[:answers].to_h { |a| ["question_#{id}_#{a[:blank_id]}", a[:text]] }
      when "multiple_dropdowns_question"
        q[:answers].select { |a| a[:weight] == 100 }.to_h { |a| ["question_#{id}_#{a[:blank_id]}", a[:id].to_s] }
      when "calculated_question"
        { "question_#{id}" => q[:answers].first[:answer].to_s }
      when "essay_question"
        { "question_#{id}" => "<p>An example answer for review.</p>" }
      else
        {}
      end
    end

    def refresh_dashboards
      say "Refreshing dashboards and pacing plans..."
      @courses.each do |entry|
        next unless entry[:fresh]

        SelfPaced::StateRefresher.rebuild_course(entry[:course])
        SelfPaced::Pacer.replan_course(entry[:course].id)
      rescue => e
        say "  refresh skipped for #{entry[:course].name}: #{e.class}: #{e.message.truncate(120)}"
      end
    end

    def summary
      say <<~TEXT

        Demo data ready. All accounts use the password "#{PASSWORD}".
          Teachers:  demo.teacher1@example.com ... demo.teacher#{TEACHERS.length}@example.com
          Mentors:   demo.mentor1@example.com, demo.mentor2@example.com
          Editor:    demo.editor@example.com
          Students:  demo.student01@example.com ... demo.student#{STUDENT_COUNT}@example.com
          Parents:   demo.parent01@example.com ... demo.parent#{PARENT_COUNT}@example.com
      TEXT
    end
  end
end

namespace :db do
  desc "Create demo students, courses, staff, parents and sample progress"
  task demo_data: :load_environment do
    DemoData::Builder.new.run
  end
end
